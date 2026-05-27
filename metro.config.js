const { getDefaultConfig } = require("expo/metro-config");

// NativeWind v2 works purely via the Babel plugin (nativewind/babel).
// No Metro transformer replacement needed → fully compatible with Metro 0.84.4.
const config = getDefaultConfig(__dirname);

module.exports = config;
