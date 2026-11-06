import { useTranslation } from "react-i18next";
import { groupByModule, type Permission, type PermissionKey, type PermissionModule } from "@/api/mappers";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type PermissionMatrixProps = {
  catalogue: Permission[];
  value: PermissionKey[];
  onChange: (keys: PermissionKey[]) => void;
  readOnly: boolean;
};

const ACTION_ORDER = ["read", "create", "update", "delete", "reset_password", "assign_roles"];

// Modules as rows, actions as columns (ui.md, ECR-008). The column set comes from the catalogue, never hard-coded rows.
export function PermissionMatrix({ catalogue, value, onChange, readOnly }: PermissionMatrixProps) {
  const { t } = useTranslation();
  const modules = groupByModule(catalogue);
  const actions = [...new Set(catalogue.map((p) => p.action))].sort(
    (a, b) => (ACTION_ORDER.indexOf(a) + 1 || 99) - (ACTION_ORDER.indexOf(b) + 1 || 99),
  );
  const selected = new Set(value);

  const setKeys = (keys: PermissionKey[], checked: boolean) => {
    const next = new Set(selected);
    for (const key of keys) {
      if (checked) next.add(key);
      else next.delete(key);
    }
    onChange([...next]);
  };
  const moduleState = (module: PermissionModule) => {
    const count = module.permissions.filter((p) => selected.has(p.key)).length;
    return count === 0 ? false : count === module.permissions.length ? true : "indeterminate";
  };
  // permissions.modules.dashboard | users | departments | roles | permissions | activity_logs | login_history
  const moduleLabel = (module: string) => t(`permissions.modules.${module}`, { defaultValue: module });
  // permissions.actions.read | create | update | delete | reset_password | assign_roles
  const actionLabel = (action: string) => t(`permissions.actions.${action}`, { defaultValue: action });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => onChange(catalogue.map((p) => p.key))}>
            {t("roles.matrix.select_all")}
          </Button>
          <Button variant="outline" size="sm" className="min-h-11 sm:min-h-0" onClick={() => onChange([])}>
            {t("roles.matrix.select_none")}
          </Button>
        </div>
      )}

      <div className="hidden overflow-x-auto rounded-md border md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("roles.matrix.module")}</TableHead>
              {actions.map((action) => (
                <TableHead key={action} className="text-center">
                  {actionLabel(action)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {modules.map((module) => (
              <TableRow key={module.module}>
                <TableCell>
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={moduleState(module)}
                      disabled={readOnly}
                      onCheckedChange={(checked) => setKeys(module.permissions.map((p) => p.key), checked === true)}
                      aria-label={t("roles.matrix.whole_module", { module: moduleLabel(module.module) })}
                    />
                    <span>
                      <span className="block font-medium">{moduleLabel(module.module)}</span>
                      <code className="font-mono text-xs text-muted-foreground">{module.module}</code>
                    </span>
                  </label>
                </TableCell>
                {actions.map((action) => {
                  const permission = module.permissions.find((p) => p.action === action);
                  return (
                    <TableCell key={action} className="text-center">
                      {permission ? (
                        <Checkbox
                          checked={selected.has(permission.key)}
                          disabled={readOnly}
                          onCheckedChange={(checked) => setKeys([permission.key], checked === true)}
                          aria-label={`${permission.key}: ${permission.description ?? ""}`}
                          title={permission.key}
                        />
                      ) : (
                        <span className="text-muted-foreground" aria-hidden="true">
                          -
                        </span>
                      )}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {modules.map((module) => (
          <li key={module.module} className="rounded-md border bg-card p-3">
            <label className="flex min-h-11 items-center gap-3">
              <Checkbox
                className="size-11 sm:size-4"
                checked={moduleState(module)}
                disabled={readOnly}
                onCheckedChange={(checked) => setKeys(module.permissions.map((p) => p.key), checked === true)}
                aria-label={t("roles.matrix.whole_module", { module: moduleLabel(module.module) })}
              />
              <span className="font-medium">{moduleLabel(module.module)}</span>
            </label>
            <ul className="mt-2 space-y-1 pl-2">
              {module.permissions.map((permission) => (
                <li key={permission.key}>
                  <label className="flex min-h-11 items-center gap-3">
                    <Checkbox
                      className="size-11 sm:size-4"
                      checked={selected.has(permission.key)}
                      disabled={readOnly}
                      onCheckedChange={(checked) => setKeys([permission.key], checked === true)}
                    />
                    <span className="min-w-0">
                      <span className="block text-sm">{actionLabel(permission.action)}</span>
                      <code className="font-mono text-xs text-muted-foreground">{permission.key}</code>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
