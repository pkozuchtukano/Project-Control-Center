// Run: node scripts/maintenanceVariables.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const dateFns = require('date-fns');

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
}).outputText;
const dateModule = { exports: {} };
vm.runInNewContext(compile(fs.readFileSync('src/utils/dateParsing.ts', 'utf8')), {
  require, exports: dateModule.exports, module: dateModule,
});

const source = fs.readFileSync('src/features/dashboard/components/DashboardView.tsx', 'utf8');
const ast = ts.createSourceFile('DashboardView.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = ast.statements.filter(ts.isVariableStatement);
const named = name => declarations.find(statement => statement.declarationList.declarations.some(d => d.name.getText(ast) === name));
const helpers = declarations.filter(statement => statement.pos >= named('createEmptyEmailTemplate').pos && statement.pos <= named('parseCalendarDate').pos);
const code = [...helpers, named('createOrderProtocolStep'), named('MaintenanceSettlementFlowModal')].map(s => s.getText(ast)).join('\n');
const context = {
  require, exports: {}, React, ...dateFns, ...dateModule.exports,
  normalizeMaintenanceSettlementPeriodMonths: value => value || 1,
  formatMaintenancePeriod: month => month,
  createClientId: () => 'step',
  useEffect: () => {},
  window: {},
};
vm.createContext(context);
vm.runInContext(compile(code + '\nexports.api = { MaintenanceSettlementFlowModal, DynamicProtocolVariableField, resolveMaintenanceSettlementTemplate, createMaintenanceInvoiceEmailTemplateData };'), context);
const api = context.exports.api;
const entry = {
  id: 'entry', month: '2026-10', netAmount: 100, vatRate: 23, grossAmount: 123,
  invoiceFlow: { steps: [{ id: 'step', description: '{{numer_faktury}} {{NUMER_FAKTURY}} {{kwota_brutto}} {{grossAmount}} {{data+3d}}', linkLabel: '{{etykieta}}', linkUrl: 'https://example.com/{{link}}' }], completedStepIds: [] },
};
const project = { id: 'project', code: 'PCC' };
const saved = api.createMaintenanceInvoiceEmailTemplateData(project.id, {
  emailTemplate: { to: '{{adres}}', cc: '{{kopia}}', subject: '{{temat}}', body: '{{tresc}} {{slownie(kwota)}}', variables: { numer_faktury: 'FV/10/2026', kwota: '123' } },
});
let stateIndex = 0;
let nextTemplate;
context.useState = initial => {
  const index = stateIndex++;
  const value = index === 4 ? saved : typeof initial === 'function' ? initial() : initial;
  return [value, update => { if (index === 4) nextTemplate = typeof update === 'function' ? update(saved) : update; }];
};
for (const name of ['FileText', 'Edit2', 'X', 'ChevronDown', 'ArrowUp', 'ArrowDown', 'Trash2', 'Plus', 'ExternalLink', 'CheckCircle', 'Mail', 'Loader2', 'Copy']) context[name] = () => null;
const tree = api.MaintenanceSettlementFlowModal({ isOpen: true, entry, project, mode: 'invoice', onClose() {}, onSave() {} });
const fields = [];
const walk = element => {
  if (!element || typeof element !== 'object') return;
  if (element.type === api.DynamicProtocolVariableField) fields.push(element.props);
  React.Children.forEach(element.props?.children, walk);
};
walk(tree);
assert.deepEqual(fields.map(field => field.token).sort(), ['NUMER_FAKTURY', 'adres', 'etykieta', 'kopia', 'kwota', 'link', 'temat', 'tresc'].sort());
assert.equal(fields.find(field => field.token === 'NUMER_FAKTURY').value, 'FV/10/2026');
fields.find(field => field.token === 'link').onChange('link', 'document');
assert.equal(nextTemplate.emailTemplate.variables.link, 'document');
assert.equal(nextTemplate.emailTemplate.variables.numer_faktury, 'FV/10/2026');
const reloaded = api.createMaintenanceInvoiceEmailTemplateData(project.id, JSON.parse(JSON.stringify(nextTemplate)));
const resolve = text => api.resolveMaintenanceSettlementTemplate(text, entry, project, reloaded.emailTemplate.variables);
assert.equal(resolve('{{numer_faktury}} {{NUMER_FAKTURY}}'), 'FV/10/2026 FV/10/2026');
assert.equal(resolve('https://example.com/{{link}}'), 'https://example.com/document');
assert.equal(resolve('{{slownie(kwota)}}'), 'sto dwadzie\u015bcia trzy z\u0142ote 00/100 groszy');
assert.equal(resolve('{{data+3d}}'), '03.11.2026');
assert.equal(resolve('{{brak}}'), '{{brak}}');
console.log('Maintenance variables: detection, editing, persistence and substitution passed.');
