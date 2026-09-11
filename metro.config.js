// Configuración de Metro (el empaquetador de Expo/React Native).
// Excluimos carpetas pesadas e innecesarias dentro de node_modules
// (código nativo android/ios de cada librería, tests, docs, ejemplos)
// para reducir drásticamente el número de archivos que se vigilan
// y evitar el error "EMFILE: too many open files, watch" en macOS
// cuando no se dispone de Watchman.

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  /node_modules\/.*\/(android|ios)\/.*/,
  /node_modules\/.*\/(docs?|example|examples|__tests__|test|tests)\/.*/,
  /node_modules\/.*\.(md|markdown)$/,
  /node_modules\/.*\/\.git\/.*/,
];

module.exports = config;
