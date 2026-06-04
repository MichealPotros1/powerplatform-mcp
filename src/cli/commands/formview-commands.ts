import type { Command } from 'commander';
import type { EnvironmentRegistry } from '../../environment-config.js';
import { outputResult } from '../output.js';

function normalizeName(value: string): string {
  return value.trim().toLowerCase();
}

function resolveSingleByName<T extends { name: string }>(
  items: T[],
  targetName: string,
  itemType: 'form' | 'view',
): T {
  const normalizedTarget = normalizeName(targetName);
  const exact = items.filter((i) => normalizeName(i.name) === normalizedTarget);
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(`Multiple ${itemType}s found with name '${targetName}'. Please use the ID-based command.`);
  }

  const partial = items.filter((i) => normalizeName(i.name).includes(normalizedTarget));
  if (partial.length === 1) {
    return partial[0];
  }
  if (partial.length > 1) {
    const names = partial.map((i) => `  ${i.name}`).join('\n');
    throw new Error(`Multiple ${itemType}s matched '${targetName}'. Please be more specific:\n${names}`);
  }

  throw new Error(`No ${itemType} found matching '${targetName}'.`);
}

export function registerFormViewCommands(program: Command, registry: EnvironmentRegistry): void {
  // ─── FORMS ─────────────────────────────────────────────────────────────────

  program
    .command('entity-forms <entityName>')
    .description('List forms for a Dataverse entity')
    .option('--type <n>', 'Form type: 2=Main, 5=QuickView, 6=QuickCreate, 7=Dashboard')
    .action(async (entityName: string, opts: { type?: string }, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const type = opts.type ? parseInt(opts.type, 10) : undefined;
      const forms = await service.getEntityForms(entityName, type);

      const typeLabel = (t: number) => ({ 2: 'Main', 5: 'QuickView', 6: 'QuickCreate', 7: 'Dashboard' }[t] ?? `Type ${t}`);
      const formList = forms.map(f => `  ${f.formid}  ${typeLabel(f.type).padEnd(12)} ${f.name}`).join('\n');

      outputResult({
        fileName: `${entityName}-forms`,
        data: forms,
        summary: [`Found ${forms.length} forms for '${entityName}':`, formList].filter(Boolean).join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('entity-form-fields <formId>')
    .description('List fields currently on a Dataverse form')
    .action(async (formId: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const fields = await service.getFormFields(formId);

      outputResult({
        fileName: `form-${formId}-fields`,
        data: fields,
        summary: [`Form ${formId} has ${fields.length} fields:`, ...fields.map(f => `  ${f}`)].join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('entity-form-fields-by-name <entityName> <formName>')
    .description('List fields currently on a Dataverse form by form name')
    .option('--type <n>', 'Form type: 2=Main, 5=QuickView, 6=QuickCreate, 7=Dashboard')
    .action(async (entityName: string, formName: string, opts: { type?: string }, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const type = opts.type ? parseInt(opts.type, 10) : undefined;

      const forms = await service.getEntityForms(entityName, type);
      const form = resolveSingleByName(forms, formName, 'form');
      const fields = await service.getFormFields(form.formid);

      outputResult({
        fileName: `form-${form.formid}-fields`,
        data: { formId: form.formid, formName: form.name, fields },
        summary: [`Form '${form.name}' (${form.formid}) has ${fields.length} fields:`, ...fields.map(f => `  ${f}`)].join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('add-form-field <entityName> <formId> <attributeName>')
    .description('Add a field to a Dataverse form')
    .action(async (entityName: string, formId: string, attributeName: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const result = await service.addFormField(formId, attributeName, entityName);

      outputResult({
        fileName: `form-${formId}-add-${attributeName}`,
        data: result,
        summary: result.added
          ? `Added '${attributeName}' to form ${formId} and published '${entityName}'.`
          : `'${attributeName}' is already on the form — no change.`,
      }, ctx.environmentName);
    });

  program
    .command('remove-form-field <entityName> <formId> <attributeName>')
    .description('Remove a field from a Dataverse form')
    .action(async (entityName: string, formId: string, attributeName: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const result = await service.removeFormField(formId, attributeName, entityName);

      outputResult({
        fileName: `form-${formId}-remove-${attributeName}`,
        data: result,
        summary: result.removed
          ? `Removed '${attributeName}' from form ${formId} and published '${entityName}'.`
          : `'${attributeName}' was not on the form — no change.`,
      }, ctx.environmentName);
    });

  // ─── VIEWS ─────────────────────────────────────────────────────────────────

  program
    .command('entity-views <entityName>')
    .description('List views (saved queries) for a Dataverse entity')
    .action(async (entityName: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const views = await service.getEntityViews(entityName);

      const viewList = views.map(v =>
        `  ${v.savedqueryid}  ${v.isdefault ? '(default)' : '         '} ${v.name}`
      ).join('\n');

      outputResult({
        fileName: `${entityName}-views`,
        data: views,
        summary: [`Found ${views.length} views for '${entityName}':`, viewList].filter(Boolean).join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('entity-view-fields <viewId>')
    .description('List columns currently in a Dataverse view')
    .action(async (viewId: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const columns = await service.getViewColumns(viewId);

      outputResult({
        fileName: `view-${viewId}-columns`,
        data: columns,
        summary: [`View ${viewId} has ${columns.length} columns:`, ...columns.map(c => `  ${c}`)].join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('entity-view-fields-by-name <entityName> <viewName>')
    .description('List columns currently in a Dataverse view by view name')
    .action(async (entityName: string, viewName: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();

      const views = await service.getEntityViews(entityName);
      const view = resolveSingleByName(views, viewName, 'view');
      const columns = await service.getViewColumns(view.savedqueryid);

      outputResult({
        fileName: `view-${view.savedqueryid}-columns`,
        data: { viewId: view.savedqueryid, viewName: view.name, columns },
        summary: [`View '${view.name}' (${view.savedqueryid}) has ${columns.length} columns:`, ...columns.map(c => `  ${c}`)].join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('add-view-column <entityName> <viewId> <attributeName>')
    .description('Add a column to a Dataverse view')
    .option('--width <n>', 'Column width in pixels', '150')
    .action(async (entityName: string, viewId: string, attributeName: string, opts: { width: string }, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const result = await service.addViewColumn(viewId, attributeName, entityName, parseInt(opts.width, 10));

      outputResult({
        fileName: `view-${viewId}-add-${attributeName}`,
        data: result,
        summary: result.added
          ? `Added '${attributeName}' to view ${viewId} and published '${entityName}'.`
          : `'${attributeName}' is already in the view — no change.`,
      }, ctx.environmentName);
    });

  program
    .command('set-view-columns <entityName> <viewId> <columns...>')
    .description('Replace the entire column set of a Dataverse view. Columns are attribute names, optionally with :width (e.g. br_side:100 br_type:150).')
    .option('--order-by <attr>', 'Attribute to sort by (default: first column)')
    .option('--desc', 'Sort descending', false)
    .action(async (entityName: string, viewId: string, columns: string[], opts: {
      orderBy?: string;
      desc: boolean;
    }, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();

      const parsed = columns.map(c => {
        const parts = c.split(':');
        return { name: parts[0], width: parts[1] ? parseInt(parts[1], 10) : undefined };
      });

      const result = await service.setViewColumns(viewId, parsed, entityName, opts.orderBy, opts.desc);

      outputResult({
        fileName: `view-${viewId}-set-columns`,
        data: result,
        summary: [
          `Set ${result.columns.length} columns on view ${viewId}:`,
          ...result.columns.map(c => `  ${c}`),
          `Published '${entityName}'.`,
        ].join('\n'),
      }, ctx.environmentName);
    });

  program
    .command('remove-view-column <entityName> <viewId> <attributeName>')
    .description('Remove a column from a Dataverse view')
    .action(async (entityName: string, viewId: string, attributeName: string, _opts: unknown, command: Command) => {
      const ctx = registry.getContext(command.optsWithGlobals().env);
      const service = ctx.getFormViewService();
      const result = await service.removeViewColumn(viewId, attributeName, entityName);

      outputResult({
        fileName: `view-${viewId}-remove-${attributeName}`,
        data: result,
        summary: result.removed
          ? `Removed '${attributeName}' from view ${viewId} and published '${entityName}'.`
          : `'${attributeName}' was not in the view — no change.`,
      }, ctx.environmentName);
    });
}
