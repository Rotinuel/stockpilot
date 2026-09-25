"use client";

import { useState } from "react";
import { Megaphone } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, CardHeader, CardBody } from "@/components/ui/Card";
import { Field, Input, Select, Textarea } from "@/components/ui/Field";
import { useConfirm } from "@/components/ui/Confirm";
import { apiFetch, useAction } from "@/hooks/useApi";

export default function AnnouncementForm() {
  const [v, setV] = useState({ title: "", message: "", severity: "info" });
  const { run, loading, errors } = useAction();
  const confirm = useConfirm();
  const submit = async (e) => {
    e.preventDefault();
    if (!(await confirm({ title: "Send to every business?", message: "This creates an in-app notification for all tenants.", confirmLabel: "Send announcement" }))) return;
    const res = await run(() => apiFetch("/api/admin/announcements", { method: "POST", body: v }), { success: "Announcement sent" });
    if (res) setV({ title: "", message: "", severity: "info" });
  };
  return (
    <Card>
      <CardHeader title="System announcement" icon={Megaphone} description="In-app notification to all businesses" />
      <CardBody>
        <form onSubmit={submit} className="space-y-3">
          <Field label="Title" error={errors.title}>
            <Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} />
          </Field>
          <Field label="Message" error={errors.message}>
            <Textarea rows={3} value={v.message} onChange={(e) => setV({ ...v, message: e.target.value })} />
          </Field>
          <Field label="Severity">
            <Select value={v.severity} onChange={(e) => setV({ ...v, severity: e.target.value })}>
              <option value="info">Info</option>
              <option value="success">Success</option>
              <option value="warning">Warning</option>
              <option value="danger">Critical</option>
            </Select>
          </Field>
          <Button type="submit" loading={loading} className="w-full">
            Send
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
