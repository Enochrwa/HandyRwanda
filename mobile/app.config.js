// File: mobile/app.config.js
// Production build config — extends app.json with Firebase plugins.
// Used by: expo run:android, EAS Build
// For Expo Go testing: use app.json directly (no firebase plugins needed)

const baseConfig = require('./app.json');

const isProduction = process.env.APP_ENV === 'production' || process.env.EAS_BUILD;
const isDevClient = process.env.EXPO_DEV_CLIENT || process.env.APP_ENV === 'development';

// Only add Firebase plugins for native builds (not Expo Go)
const firebasePlugins =
  isProduction || isDevClient
    ? ['@react-native-firebase/app', '@react-native-firebase/messaging']
    : [];

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    plugins: [...baseConfig.expo.plugins, ...firebasePlugins],
    extra: {
      ...baseConfig.expo.extra,
      APP_ENV: process.env.APP_ENV || 'development',
      isExpoGo: !isProduction && !isDevClient,
    },
  },
};
