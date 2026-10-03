/**
 * react-native.config.js - tells the autolinker where our custom native
 * Kotlin modules live (though @react-native-community/cli usually auto-detects
 * them under android/app/src/main/java/... this keeps them registered).
 */
module.exports = {
  project: {
    ios: {},
    android: {},
  },
  assets: ['./assets/'],
  dependencies: {},
};
