const src = require("fs").readFileSync("./src/styles/nativewind-styles.generated.js", "utf8");
// Replace export const with assignment using var for eval scope
const mod = src.replace("export const nativewindStyles = ", "globalThis._nw = ").replace(/;\s*$/, "");
eval(mod);
const nativewindStyles = globalThis._nw;
console.log("Top-level keys:", Object.keys(nativewindStyles));
console.log("Has rules?", !!nativewindStyles.rules);
console.log("Has keyframes?", !!nativewindStyles.keyframes);
console.log("Has rootVariables?", !!nativewindStyles.rootVariables);
if (nativewindStyles.rules) {
  const ruleKeys = Object.keys(nativewindStyles.rules);
  console.log("Rule count:", ruleKeys.length);
  console.log("Sample rule keys:", ruleKeys.slice(0, 5));
}
