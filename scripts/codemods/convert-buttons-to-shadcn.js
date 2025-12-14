const SHADCN_SRC = "@/components/ui/button";

/** @type {(fileInfo: any, api: any) => string | null} */
module.exports = function transformer(file, api) {
  const j = api.jscodeshift;
  const root = j(file.source);

  // Skip UI internals (we don't want to rewrite the Button component itself, Chip, Drawer, etc.)
  if (/(^|\/)components\/ui\//.test(file.path)) return file.source;

  let changed = false;

  // Replace <button>...</button> with <Button type="button">...</Button>
  root.find(j.JSXElement, {
    openingElement: { name: { type: 'JSXIdentifier', name: 'button' } },
  }).forEach(path => {
    changed = true;
    const opening = path.node.openingElement;
    const closing = path.node.closingElement;

    opening.name.name = 'Button';
    if (closing) closing.name.name = 'Button';

    // Ensure type="button" if not present
    const hasType = (opening.attributes || []).some(
      a => a.type === 'JSXAttribute' && a.name && a.name.name === 'type'
    );
    if (!hasType) {
      opening.attributes = opening.attributes || [];
      opening.attributes.push(
        j.jsxAttribute(j.jsxIdentifier('type'), j.stringLiteral('button'))
      );
    }
  });

  if (!changed) return null;

  // Ensure: import { Button } from "@/components/ui/button"
  const imports = root.find(j.ImportDeclaration);

  // If already have correct import, add specifier if missing
  const correct = imports.filter(p => p.node.source.value === SHADCN_SRC);
  if (correct.size() > 0) {
    correct.forEach(p => {
      const hasButton = (p.node.specifiers || []).some(
        s => s.type === 'ImportSpecifier' && s.imported && s.imported.name === 'Button'
      );
      if (!hasButton) {
        p.node.specifiers = p.node.specifiers || [];
        p.node.specifiers.push(j.importSpecifier(j.identifier('Button')));
      }
    });
  } else {
    // If Button is imported from a different path, retarget to the shadcn path
    let retargeted = false;
    imports.forEach(p => {
      const hasButton = (p.node.specifiers || []).some(
        s => s.type === 'ImportSpecifier' && s.imported && s.imported.name === 'Button'
      );
      if (hasButton) {
        p.node.source = j.stringLiteral(SHADCN_SRC);
        retargeted = true;
      }
    });
    if (!retargeted) {
      const newImport = j.importDeclaration(
        [j.importSpecifier(j.identifier('Button'))],
        j.stringLiteral(SHADCN_SRC)
      );
      const firstImport = imports.at(0).get();
      if (firstImport) {
        j(firstImport).insertBefore(newImport);
      } else {
        root.get().node.program.body.unshift(newImport);
      }
    }
  }

  return root.toSource({ quote: 'single', reuseWhitespace: false });
};
