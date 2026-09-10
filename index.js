const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const axios = require("axios");
const { execFile } = require("child_process");

const app = express();
app.use(express.json());

const ORQUESTADOR_URL = process.env.ORQUESTADOR_URL || "http://localhost:9998";
const PORT = Number(process.env.PORT || 3000);
const AUTH_SCRIPT = process.env.AUTH_SCRIPT || "/home/jesus/cloudsolutions/scripts/auth_cliente.py";
const PYTHON_BIN = process.env.PYTHON_BIN || "/usr/bin/python3";
const GERALD_TELEFONO = process.env.GERALD_TELEFONO || "56965360661";

const commandSessions = {};
const SESSION_TTL_MS = 5 * 60 * 1000;
const puppeteerExecutablePath = process.env.PUPPETEER_EXECUTABLE_PATH;

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: "/app/.wwebjs_auth" }),
  puppeteer: {
    ...(puppeteerExecutablePath ? { executablePath: puppeteerExecutablePath } : {}),
    headless: "new",
    timeout: 120000,
    args: [
      "--no-sandbox", "--disable-setuid-sandbox", "--no-zygote",
      "--disable-dev-shm-usage", "--disable-gpu", "--disable-extensions",
      "--disable-software-rasterizer",
    ],
  },
});

app.post("/send-message", async (req, res) => {
  const { to, message } = req.body;
  if (!to || !message)
    return res.status(400).json({ status: "error", message: "Missing to or message" });
  try {
    const chatId = to.includes("@c.us") ? to : to + "@c.us";
    await client.sendMessage(chatId, String(message));
    res.json({ status: "ok" });
  } catch (err) {
    console.error("Error enviando mensaje:", err.message);
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/qr", (req, res) => {
  if (lastQr) {
    const qrUrl = "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" + encodeURIComponent(lastQr);
    res.json({ qr: lastQr, qr_image: qrUrl });
  } else {
    res.json({ qr: null, status: "waiting" });
  }
});

let lastQr = null;

client.on("qr", (qr) => {
  lastQr = qr;
  console.log("QR generado.");
});

client.on("ready", () => console.log("Cliente de WhatsApp conectado!"));
client.on("auth_failure", (message) => console.error("Fallo de autenticacion:", message));
client.on("disconnected", (reason) => { console.log("Cliente desconectado:", reason); lastQr = null; });

function setSession(from, data) { commandSessions[from] = { ...data, createdAt: Date.now() }; }
function clearSession(from) { delete commandSessions[from]; }

function normalizeCommand(rawBody) {
  const body = (rawBody || "").trim();
  const lower = body.toLowerCase();
  const commandMap = {
    "/estado": "estado", "estado": "estado",
    "/reiniciar": "reiniciar", "reiniciar": "reiniciar",
    "/backup": "backup", "backup": "backup",
  };
  const parts = lower.split(/\s+/).filter(Boolean);
  const command = commandMap[parts[0]] || "";
  const identifier = parts.slice(1).join(" ");
  return { action: command, identifier };
}

async function verifyCredentials(identifier, password) {
  try {
    const { stdout } = await execFile(PYTHON_BIN, [AUTH_SCRIPT, identifier, password]);
    return stdout.trim();
  } catch { return ""; }
}

async function execSSH(command, identifier) {
  try {
    const script = "/home/jesus/cloudsolutions/venv/bin/python /home/jesus/cloudsolutions/scripts/manage_cliente.py " + command + " " + identifier;
    const { stdout } = await execFile("/bin/bash", ["-c", script]);
    return stdout.trim() || "Comando ejecutado.";
  } catch (err) {
    return "Error ejecutando comando: " + err.message;
  }
}

async function callOrquestador(mensaje, from, chatName) {
  try {
    const res = await axios.post(ORQUESTADOR_URL + "/agent", {
      message: mensaje,
      user: from,
      chat_name: chatName
    }, { timeout: 120000 });
    return res.data;
  } catch (err) {
    console.error("Error orquestador:", err.message);
    return null;
  }
}

async function getChatName(msg) {
  try {
    const chat = await msg.getChat();
    return chat.name || "";
  } catch { return ""; }
}

client.on("message", async (msg) => {
  try {
    const from = msg.from;
    const rawBody = msg.body;
    const shortFrom = from.split("@")[0] || "Cliente";
    console.log("Msg de " + shortFrom + ": " + rawBody.substring(0, 50));

    if (rawBody === "!ping") { await client.sendMessage(from, "pong"); return; }

    if (rawBody === "!ejecutivo") {
      await callOrquestador(rawBody, from, shortFrom);
      await client.sendMessage(from, "Un ejecutivo te contactara en breve.");
      return;
    }

    const sess = commandSessions[from];
    if (sess && sess.step === "await_password") {
      const v = await verifyCredentials(sess.identifier, rawBody);
      if (!v) { clearSession(from); await client.sendMessage(from, "Credenciales incorrectas."); return; }
      clearSession(from);
      await client.sendMessage(from, "Ejecutando comando...");
      await client.sendMessage(from, await execSSH(sess.action, v));
      return;
    }

    const cmd = normalizeCommand(rawBody);
    if (cmd.action) {
      if (cmd.identifier) {
        setSession(from, { action: cmd.action, identifier: cmd.identifier, step: "await_password" });
        await client.sendMessage(from, "Escribe tu contrasena de CloudSolutions.");
      } else {
        setSession(from, { action: cmd.action, step: "await_identifier" });
        await client.sendMessage(from, "Escribe tu usuario o dominio.");
      }
      return;
    }

    const chatName = await getChatName(msg) || shortFrom;
    const cleanBody = rawBody.replace(/\n/g, " ").replace(/\r/g, " ").replace(/"/g, "'");
    console.log("Enviando al orquestador...");
    const result = await callOrquestador(cleanBody, from, chatName);
    if (result && result.respuesta) {
      const agentInfo = result.agente_nombre ? "[" + result.agente_nombre + "] " : "";
      await client.sendMessage(from, agentInfo + result.respuesta);
      console.log("Respondido por " + (result.agente || "?"));
    } else {
      await client.sendMessage(from, "Lo siento, no pude procesar tu mensaje. Un ejecutivo te contactara en breve.");
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
});

setInterval(() => {
  const now = Date.now();
  for (const k of Object.keys(commandSessions)) {
    if (now - commandSessions[k].createdAt > SESSION_TTL_MS) delete commandSessions[k];
  }
}, 60 * 1000);

app.listen(PORT, () => console.log("WhatsApp Bot conectado al Orquestador en puerto " + PORT));
client.initialize();
