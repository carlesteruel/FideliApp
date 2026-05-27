const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

// NativeWind v4 + react-native-css-interop v0.2.x is NOT compatible with
// Expo SDK 56 / Metro 0.84.4 when using withNativeWind (replaces transformerPath).
// Solution: keep the Expo transformer as-is and let the Babel plugin
// (nativewind/babel in babel.config.js) handle className → style transforms.
//
// The babel plugin handles:
//  - className prop transformation to cssInterop/styled wrappers
//  - jsxImportSource "nativewind" for automatic className support
//
// Tailwind CSS classes are resolved at Babel compile time using tailwind.config.js

module.exports = config;
