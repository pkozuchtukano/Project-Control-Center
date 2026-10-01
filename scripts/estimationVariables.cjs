const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
    });
    module._compile(outputText, filename);
  };
}

const { createDefaultEstimation, getEstimationCustomVariableFields, resolveEstimationTemplate } = require('../src/features/estimation/services/EstimationService.ts');
const { EstimationVariablesSection } = require('../src/features/estimation/components/EmailTemplateSection.tsx');
const { renderToStaticMarkup } = require('react-dom/server');
const project = { id: 'project', code: 'ABC', name: 'Example' };
let estimation = createDefaultEstimation(project.id);
const steps = [{ id: 'step', description: '{{kontakt}} {{data+3d}} {{nr}}', linkLabel: '{{etykieta}}', linkUrl: 'https://example.com/{{kontakt}}' }];
assert.deepEqual(getEstimationCustomVariableFields(estimation, project, steps), ['etykieta', 'kontakt', 'podpis']);

const renderPanel = () => EstimationVariablesSection({ estimation, project, flowSteps: steps, setEstimation: update => { estimation = update(estimation); } });
const inputs = [];
const visit = node => {
  if (Array.isArray(node)) return node.forEach(visit);
  if (!node || typeof node !== 'object') return;
  if (node.type === 'input') inputs.push(node);
  visit(node.props?.children);
};
visit(renderPanel());
assert.equal(inputs.length, 4);
inputs[0].props.onChange({ target: { value: '2026-09-30' } });
inputs[2].props.onChange({ target: { value: 'Anna' } });
assert.equal(estimation.emailTemplate.variables.data, '30.09.2026');
assert.equal(resolveEstimationTemplate('{{kontakt}} {{data+3d}} {{nr}}', estimation, project, estimation.emailTemplate.variables), 'Anna 03.10.2026 ABC');
assert.match(renderToStaticMarkup(renderPanel()), /value="Anna"/);
estimation = JSON.parse(JSON.stringify(estimation));
assert.equal(estimation.emailTemplate.variables.kontakt, 'Anna');
delete estimation.emailTemplate;
inputs[0].props.onChange({ target: { value: '2026-10-01' } });
assert.equal(estimation.emailTemplate.to, '');
console.log('Estimation variables: OK');
