#!/bin/sh
# Borrar todos los archivos de bloqueo que impiden que Chromium arranque
echo "Limpiando candados de Chromium..."
rm -rf /usr/src/app/.wwebjs_auth/SingletonLock
rm -rf /usr/src/app/.wwebjs_auth/SingletonCookie
rm -rf /usr/src/app/.wwebjs_auth/session/SingletonLock

# Iniciar la aplicación
echo "Iniciando bot..."
exec node index.js