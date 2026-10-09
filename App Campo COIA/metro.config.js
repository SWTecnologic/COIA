const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Configurações de resolver
config.resolver.alias = {
  '@': path.resolve(__dirname, './'),
};

// Configurações de assets
config.resolver.assetExts.push(
  // Adicionar extensões de assets se necessário
  'db', 'mp3', 'ttf', 'obj', 'png', 'jpg'
);

// Configurações de source
config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');

// Configurações de transformer
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = config;