import 'dotenv/config';

export default {
  expo: {
    name: "COIA Campo",
    slug: "coia-campo",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: "coiacampo",
    userInterfaceStyle: "light",

    platforms: ["android", "ios"],

    extra: {
      supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY,
      appName: process.env.EXPO_PUBLIC_APP_NAME || "COIA Campo",
      appVersion: process.env.EXPO_PUBLIC_APP_VERSION || "1.0.0",
      environment: process.env.EXPO_PUBLIC_ENVIRONMENT || "development"
    },

    android: {
      package: "com.coia.campo",
      versionCode: 1,
      adaptiveIcon: {
        foregroundImage: "./assets/images/icon.png",
        backgroundColor: "#7C3AED"
      },
      permissions: [
        "ACCESS_COARSE_LOCATION",
        "ACCESS_FINE_LOCATION",
        "FOREGROUND_SERVICE",
        "WAKE_LOCK"
      ],
      config: {
        googleMaps: {
          apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
        }
      }
    },

    ios: {
      bundleIdentifier: "com.coia.campo",
      buildNumber: "1.0.0",
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "Este app precisa acessar sua localização para mostrar ocorrências próximas e sua posição no mapa.",
        NSLocationAlwaysAndWhenInUseUsageDescription: "Este app precisa acessar sua localização para funcionar corretamente como técnico de campo."
      },
      config: {
        googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY
      }
    },

    plugins: [
      "expo-router",
      "expo-font",
      [
        "expo-location",
        {
          locationAlwaysAndWhenInUsePermission: "Este app precisa acessar sua localização para mostrar ocorrências próximas e sua posição no mapa."
        }
      ],
      [
        "expo-notifications",
        {
          icon: "./assets/images/icon.png",
          color: "#7C3AED",
          defaultChannel: "default"
        }
      ]
    ],

    experiments: {
      typedRoutes: true
    },

    updates: {
      fallbackToCacheTimeout: 0
    },

    assetBundlePatterns: ["**/*"],

    web: {
      bundler: "metro"
    }
  }
};