// Customer / supplier balance payments with FIFO allocation to open invoices.
import BalancePayment from "../models/BalancePayment.js";
import { withTransaction, Compensation } from "../lib/db.js";
import { badRequest, notFound } from "../lib/errors.js";
import { round2 } from "../lib/money.js";
import { byId, scoped, sessionOpts } from "./_scope.js";

/**
 * @param {object} p
 * @param {'customer'|'supplier'} p.partyType
 * @param {import('mongoose').Model} p.PartyModel Customer | Supplier
 * @param {import('mongoose').Model} p.DocModel Sale | Purchase
 * @param {string} p.docNumberField invoiceNumber | referenceNumber
 * @param {string} p.docDateField createdAt | purchaseDate
 * @param {string} p.partyField customerId | supplierId
 */
export async function recordBalancePayment(ctx, id, data, { partyType, PartyModel, DocModel, docNumberField, docDateField, partyField, refType }) {
  const party = await PartyModel.findOne(byId(ctx, id, { isDeleted: false })).lean();
  if (!party) throw notFound(`${partyType === "customer" ? "Customer" : "Supplier"} not found.`);
  const amount = round2(data.amount);
  if (party.balance <= 0) throw badRequest("There is no outstanding balance to pay.");
  if (amount > round2(party.balance)) throw badRequest(`Amount exceeds the outstanding balance of ${round2(party.balance).toLocaleString("en-NG")}.`, { amount: "Too high" });

  return withTransaction(async (session) => {
    const comp = new Compensation(!session);
    const opts = sessionOpts(session);
    try {
      const updated = await PartyModel.findOneAndUpdate(
        { _id: party._id, tenantId: ctx.tenantId, balance: { $gte: amount - 0.001 } },
        { $inc: { balance: -amount, totalPaid: amount } },
        { new: true, ...opts },
      ).lean();
      if (!updated) throw badRequest("The balance changed while recording this payment. Please refresh and try again.");
      comp.add(() => PartyModel.updateOne({ _id: party._id }, { $inc: { balance: amount, totalPaid: -amount } }));

      // FIFO allocation across open invoices
      let remaining = amount;
      const allocations = [];
      const openDocs = await DocModel.find(
        scoped(ctx, { [partyField]: party._id, status: "completed", balance: { $gt: 0 } }),
        null,
        opts,
      )
        .sort({ [docDateField]: 1 })
        .lean();
      for (const doc of openDocs) {
        if (remaining <= 0) break;
        const apply = round2(Math.min(remaining, doc.balance));
        const newBalance = round2(doc.balance - apply);
        await DocModel.updateOne(
          { _id: doc._id, tenantId: ctx.tenantId },
          { $inc: { amountPaid: apply, balance: -apply }, $set: { paymentStatus: newBalance <= 0 ? "paid" : "partial" } },
          opts,
        );
        comp.add(() => DocModel.updateOne({ _id: doc._id }, { $inc: { amountPaid: -apply, balance: apply }, $set: { paymentStatus: doc.paymentStatus } }));
        allocations.push({ referenceType: refType, referenceId: doc._id, referenceNumber: doc[docNumberField], amount: apply });
        remaining = round2(remaining - apply);
      }

      const [payment] = await BalancePayment.create(
        [
          {
            tenantId: ctx.tenantId,
            partyType,
            partyId: party._id,
            amount,
            method: data.method,
            note: data.note,
            allocations,
            balanceBefore: round2(party.balance),
            balanceAfter: round2(updated.balance),
            recordedBy: ctx.userId,
            recordedByName: ctx.userName,
          },
        ],
        opts,
      );
      return { payment: payment.toObject(), balance: round2(updated.balance) };
    } catch (err) {
      await comp.rollback();
      throw err;
    }
  });
}

export async function listBalancePayments(ctx, partyType, partyId, { limit = 20 } = {}) {
  return BalancePayment.find(scoped(ctx, { partyType, partyId })).sort({ createdAt: -1 }).limit(limit).lean();
}
