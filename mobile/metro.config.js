const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration for WorldLens.
 * Ensures .onnx model files are bundled as assets.
 */
const config = {
  resolver: {
    assetExts: [...defaultConfig.resolver.assetExts, 'onnx', 'txt'],
  },
};

module.exports = mergeConfig(defaultConfig, config);
