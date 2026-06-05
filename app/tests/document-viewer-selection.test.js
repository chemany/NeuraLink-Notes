const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(__dirname, "..", "src", "asset", "document.ts");
const source = fs.readFileSync(sourcePath, "utf8");

test("DocumentViewer 为文本类预览显式开启文本选择", () => {
    assert.match(source, /private makeSelectable\(element: HTMLElement\)/);
    assert.match(source, /element\.style\.userSelect = "text"/);
    assert.match(source, /element\.style\.webkitUserSelect = "text"/);
});

test("DocumentViewer 在文本和 Office 预览中应用可选中样式", () => {
    assert.match(source, /this\.makeSelectable\(content\);/);
    assert.match(source, /this\.makeSelectable\(pre\);/);
    assert.match(source, /this\.makeSelectable\(wrapper\);/);
    assert.match(source, /this\.makeSelectable\(container\);/);
    assert.match(source, /this\.makeSelectable\(sheetDiv\);/);
});
