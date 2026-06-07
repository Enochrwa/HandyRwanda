// File: mobile/app.config.js
// Production build config — extends app.json with Firebase plugins.
//
// FIREBASE SETUP REQUIRED FOR NATIVE BUILDS
// ==========================================
// Native push notifications (FCM) require two files that are NOT committed
// to the repository (they contain sensitive project credentials):
//
//   Android: mobile/android/app/google-services.json
//   iOS:     mobile/ios/GoogleService-Info.plist
//
// Steps to enable:
//   1. Go to https://console.firebase.google.com
//   2. Create a project (or use existing)
//   3. Add Android app: package name = com.enochlabs.handyrwanda
//   4. Add iOS app: bundle ID = com.enochlabs.handyrwanda
//   5. Download google-services.json → place at mobile/android/app/google-services.json
//   6. Download GoogleService-Info.plist → place at mobile/ios/GoogleService-Info.plist
//   7. Run: eas build --profile development --platform android
//
// Expo Go testing (no native build):
//   Firebase files are NOT required. Push notifications won't work but
//   all other features function normally via Expo Go.

const baseConfig = require('./app.json');

const isProduction = process.env.APP_ENV === 'production' || !!process.env.EAS_BUILD;
const isDevClient = !!process.env.EXPO_DEV_CLIENT || process.env.APP_ENV === 'development';
const needsFirebase = isProduction || isDevClient;

const fs = require('fs');
const path = require('path');

// Gracefully check if Firebase config files exist before adding plugins
const hasAndroidFirebase = fs.existsSync(
  path.join(__dirname, 'android/app/google-services.json')
);
const hasIosFirebase = fs.existsSync(
  path.join(__dirname, 'ios/GoogleService-Info.plist')
);

if (needsFirebase && !hasAndroidFirebase) {
  console.warn(
    '\n⚠️  [HandyRwanda] android/app/google-services.json not found.\n' +
    '   Firebase push notifications will be disabled.\n' +
    '   See mobile/.env.example for setup instructions.\n'
  );
}

if (needsFirebase && !hasIosFirebase) {
  console.warn(
    '\n⚠️  [HandyRwanda] ios/GoogleService-Info.plist not found.\n' +
    '   Firebase push notifications will be disabled for iOS.\n' +
    '   See mobile/.env.example for setup instructions.\n'
  );
}

const firebasePlugins =
  needsFirebase && hasAndroidFirebase
    ? ['@react-native-firebase/app', '@react-native-firebase/messaging']
    : [];

module.exports = {
  ...baseConfig,
  expo: {
    ...baseConfig.expo,
    ios: {
      ...baseConfig.expo.ios,
      googleServicesFile:
        needsFirebase && hasIosFirebase ? './ios/GoogleService-Info.plist' : undefined,
    },
    android: {
      ...baseConfig.expo.android,
      googleServicesFile:
        needsFirebase && hasAndroidFirebase
          ? './android/app/google-services.json'
          : undefined,
    },
    plugins: [...(baseConfig.expo.plugins || []), ...firebasePlugins],
    extra: {
      ...baseConfig.expo.extra,
      APP_ENV: process.env.APP_ENV || 'development',
      isExpoGo: !isProduction && !isDevClient,
      firebaseEnabled: needsFirebase && hasAndroidFirebase,
    },
  },
};
