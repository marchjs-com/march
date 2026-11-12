// HADI March icon set — original drawings on a 24×24 grid, 1.75px rounded stroke (MIT, part of HADI March).
// Each icon is a separate export marked /* @__PURE__ */, so unused ones are tree-shaken. Shapes: see ./svg.ts.
import { defineIcon as i } from "./svg.ts";

// ---- interface
export const menu = /* @__PURE__ */ i("menu", ["M4 6h16", "M4 12h16", "M4 18h16"]);
export const x = /* @__PURE__ */ i("x", ["M18 6 6 18", "M6 6l12 12"]);
export const check = /* @__PURE__ */ i("check", ["M20 6 9 17l-5-5"]);
export const chevronDown = /* @__PURE__ */ i("chevron-down", ["m6 9 6 6 6-6"]);
export const chevronUp = /* @__PURE__ */ i("chevron-up", ["m18 15-6-6-6 6"]);
export const chevronRight = /* @__PURE__ */ i("chevron-right", ["m9 18 6-6-6-6"]);
export const chevronLeft = /* @__PURE__ */ i("chevron-left", ["m15 18-6-6 6-6"]);
export const chevronsUpDown = /* @__PURE__ */ i("chevrons-up-down", ["m7 15 5 5 5-5", "m7 9 5-5 5 5"]);
export const panelLeft = /* @__PURE__ */ i("panel-left", ["b:3,3,18,18,3", "M9 3v18"]);
export const arrowLeft = /* @__PURE__ */ i("arrow-left", ["M19 12H5", "m12 19-7-7 7-7"]);
export const arrowRight = /* @__PURE__ */ i("arrow-right", ["M5 12h14", "m12 5 7 7-7 7"]);
export const arrowUp = /* @__PURE__ */ i("arrow-up", ["M12 19V5", "m5 12 7-7 7 7"]);
export const arrowDown = /* @__PURE__ */ i("arrow-down", ["M12 5v14", "m19 12-7 7-7-7"]);
export const arrowUpRight = /* @__PURE__ */ i("arrow-up-right", ["M7 17 17 7", "M7 7h10v10"]);
export const arrowDownRight = /* @__PURE__ */ i("arrow-down-right", ["m7 7 10 10", "M17 7v10H7"]);
export const search = /* @__PURE__ */ i("search", ["o:11,11,7", "m20 20-3.6-3.6"]);
export const plus = /* @__PURE__ */ i("plus", ["M12 5v14", "M5 12h14"]);
export const minus = /* @__PURE__ */ i("minus", ["M5 12h14"]);
export const more = /* @__PURE__ */ i("more", ["o:5,12,1", "o:12,12,1", "o:19,12,1"]);
export const moreVertical = /* @__PURE__ */ i("more-vertical", ["o:12,5,1", "o:12,12,1", "o:12,19,1"]);
export const star = /* @__PURE__ */ i("star", ["M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z"]);
export const starFilled = /* @__PURE__ */ i("star-filled", ["M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.85L12 16.9l-5.25 2.75 1-5.85L3.5 9.7l5.9-.9z"], true);
export const pin = /* @__PURE__ */ i("pin", ["M9 3h6", "M10 3v6l-3.5 4.5h11L14 9V3", "M12 13.5V21"]);
export const copy = /* @__PURE__ */ i("copy", ["b:8,8,13,13,2", "M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"]);
export const refresh = /* @__PURE__ */ i("refresh", ["M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 21v-5h5"]);
export const download = /* @__PURE__ */ i("download", ["M12 3v12", "m7 10 5 5 5-5", "M5 21h14"]);
export const upload = /* @__PURE__ */ i("upload", ["M12 15V3", "m7 8 5-5 5 5", "M5 21h14"]);
export const filter = /* @__PURE__ */ i("filter", ["M3 5h18l-7 8.5V19l-4 2v-7.5z"]);
export const sliders = /* @__PURE__ */ i("sliders", ["M4 6h9", "M17 6h3", "o:15,6,2", "M4 12h3", "M11 12h9", "o:9,12,2", "M4 18h11", "M19 18h1", "o:17,18,2"]);
export const settings = /* @__PURE__ */ i("settings", ["M19.08 10.24L21.37 10.44L21.37 13.56L19.08 13.76A7.3 7.3 0 0 1 18.25 15.77L19.73 17.52L17.52 19.73L15.77 18.25A7.3 7.3 0 0 1 13.76 19.08L13.56 21.37L10.44 21.37L10.24 19.08A7.3 7.3 0 0 1 8.23 18.25L6.48 19.73L4.27 17.52L5.75 15.77A7.3 7.3 0 0 1 4.92 13.76L2.63 13.56L2.63 10.44L4.92 10.24A7.3 7.3 0 0 1 5.75 8.23L4.27 6.48L6.48 4.27L8.23 5.75A7.3 7.3 0 0 1 10.24 4.92L10.44 2.63L13.56 2.63L13.76 4.92A7.3 7.3 0 0 1 15.77 5.75L17.52 4.27L19.73 6.48L18.25 8.23A7.3 7.3 0 0 1 19.08 10.24Z", "o:12,12,3"]);
export const sun = /* @__PURE__ */ i("sun", ["o:12,12,4", "M12 2v2", "M12 20v2", "m4.9 4.9 1.4 1.4", "m17.7 17.7 1.4 1.4", "M2 12h2", "M20 12h2", "m6.3 17.7-1.4 1.4", "m19.1 4.9-1.4 1.4"]);
export const moon = /* @__PURE__ */ i("moon", ["M20.5 14.2A8.5 8.5 0 1 1 9.8 3.5a6.8 6.8 0 0 0 10.7 10.7z"]);
export const monitor = /* @__PURE__ */ i("monitor", ["b:2.5,4,19,13,2", "M8 21h8", "M12 17v4"]);
export const sparkles = /* @__PURE__ */ i("sparkles", ["M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z", "M19 3v4", "M17 5h4", "M5 17v4", "M3 19h4"]);
export const command = /* @__PURE__ */ i("command", ["M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"]);
export const logOut = /* @__PURE__ */ i("log-out", ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "m16 17 5-5-5-5", "M21 12H9"]);
export const externalLink = /* @__PURE__ */ i("external-link", ["M15 3h6v6", "M10 14 21 3", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"]);
export const link = /* @__PURE__ */ i("link", ["M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7", "M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"]);
export const edit = /* @__PURE__ */ i("edit", ["M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z", "m15 5 4 4"]);
export const trash = /* @__PURE__ */ i("trash", ["M3 6h18", "M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2", "M5 6l1 14a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2l1-14", "M10 11v6", "M14 11v6"]);
export const eye = /* @__PURE__ */ i("eye", ["M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z", "o:12,12,3"]);
export const eyeOff = /* @__PURE__ */ i("eye-off", ["M10.6 5.1A10 10 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-2.2 3.2", "M6.6 6.6C3.7 8.4 2 12 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6", "M9.9 9.9a3 3 0 0 0 4.2 4.2", "m2 2 20 20"]);
export const list = /* @__PURE__ */ i("list", ["M8 6h13", "M8 12h13", "M8 18h13", "M3.5 6h.01", "M3.5 12h.01", "M3.5 18h.01"]);
export const grid = /* @__PURE__ */ i("grid", ["b:3,3,7,7,1.5", "b:14,3,7,7,1.5", "b:3,14,7,7,1.5", "b:14,14,7,7,1.5"]);
export const layers = /* @__PURE__ */ i("layers", ["m12 2 10 5-10 5L2 7z", "m2 12 10 5 10-5", "m2 17 10 5 10-5"]);
export const hash = /* @__PURE__ */ i("hash", ["M4 9h16", "M4 15h16", "M10 3 8 21", "M16 3l-2 18"]);
export const tag = /* @__PURE__ */ i("tag", ["M12.6 2.6A2 2 0 0 0 11.2 2H4a2 2 0 0 0-2 2v7.2a2 2 0 0 0 .6 1.4l8.7 8.7a2.4 2.4 0 0 0 3.4 0l6.6-6.6a2.4 2.4 0 0 0 0-3.4z", "o:7.5,7.5,1"]);
export const send = /* @__PURE__ */ i("send", ["M22 2 11 13", "M22 2l-7 20-4-9-9-4z"]);
export const history = /* @__PURE__ */ i("history", ["M3 12a9 9 0 1 0 3-6.7L3 8", "M3 3v5h5", "M12 7v5l4 2"]);
export const calendar = /* @__PURE__ */ i("calendar", ["b:3,4.5,18,16.5,2", "M3 10h18", "M8 2.5v4", "M16 2.5v4"]);
export const clock = /* @__PURE__ */ i("clock", ["o:12,12,9", "M12 7v5l3 2"]);
export const hourglass = /* @__PURE__ */ i("hourglass", ["M5 22h14", "M5 2h14", "M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22", "M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"]);

export const maximize = /* @__PURE__ */ i("maximize", ["M15 3h6v6", "M9 21H3v-6", "M21 3l-7 7", "M3 21l7-7"]);
export const minimize = /* @__PURE__ */ i("minimize", ["M4 14h6v6", "M20 10h-6V4", "M14 10l7-7", "M3 21l7-7"]);
export const appWindow = /* @__PURE__ */ i("app-window", ["b:3,4,18,16,2", "M3 9h18", "M7 6.5h.01", "M10 6.5h.01"]);
export const columns = /* @__PURE__ */ i("columns", ["b:3,3,18,18,2", "M12 3v18"]);
export const rows = /* @__PURE__ */ i("rows", ["b:3,3,18,18,2", "M3 12h18"]);
export const gitBranch = /* @__PURE__ */ i("git-branch", ["o:6,5,2", "o:6,19,2", "o:18,7,2", "M6 7v10", "M18 9a6 6 0 0 1-6 6H8"]);
export const files = /* @__PURE__ */ i("files", ["M15 3H9a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z", "M15 3v5h5", "M4 7v12a2 2 0 0 0 2 2h9"]);

// ---- status
export const info = /* @__PURE__ */ i("info", ["o:12,12,9", "M12 16v-4", "M12 8h.01"]);
export const alertTriangle = /* @__PURE__ */ i("alert-triangle", ["M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z", "M12 9v4", "M12 17h.01"]);
export const alertCircle = /* @__PURE__ */ i("alert-circle", ["o:12,12,9", "M12 8v4", "M12 16h.01"]);
export const checkCircle = /* @__PURE__ */ i("check-circle", ["o:12,12,9", "m8.5 12 2.5 2.5 4.5-5"]);
export const xCircle = /* @__PURE__ */ i("x-circle", ["o:12,12,9", "m15 9-6 6", "m9 9 6 6"]);
export const helpCircle = /* @__PURE__ */ i("help-circle", ["o:12,12,9", "M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3", "M12 17h.01"]);
export const ban = /* @__PURE__ */ i("ban", ["o:12,12,9", "m5.7 5.7 12.6 12.6"]);
export const inbox = /* @__PURE__ */ i("inbox", ["M22 12h-6l-2 3h-4l-2-3H2", "M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1z"]);
export const bell = /* @__PURE__ */ i("bell", ["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.9 1.9 0 0 0 3.4 0"]);
export const zap = /* @__PURE__ */ i("zap", ["M13 2 4 14h7l-1 8 9-12h-7z"]);
export const flag = /* @__PURE__ */ i("flag", ["M4 22V4", "M4 4h13l-2 4.5 2 4.5H4"]);
export const target = /* @__PURE__ */ i("target", ["o:12,12,9", "o:12,12,5", "o:12,12,1"]);
export const gauge = /* @__PURE__ */ i("gauge", ["m12 14 4-4", "M3.3 19a10 10 0 1 1 17.4 0"]);
export const activity = /* @__PURE__ */ i("activity", ["M3 12h4l3-8 4 16 3-8h4"]);
export const trendingUp = /* @__PURE__ */ i("trending-up", ["m3 17 6-6 4 4 8-8", "M15 7h6v6"]);
export const trendingDown = /* @__PURE__ */ i("trending-down", ["m3 7 6 6 4-4 8 8", "M15 17h6v-6"]);
export const barChart = /* @__PURE__ */ i("bar-chart", ["M3 3v18h18", "M8 17v-5", "M13 17V8", "M18 17v-8"]);
export const dashboard = /* @__PURE__ */ i("dashboard", ["b:3,3,7,9,1.5", "b:14,3,7,5,1.5", "b:14,12,7,9,1.5", "b:3,16,7,5,1.5"]);
export const percent = /* @__PURE__ */ i("percent", ["M19 5 5 19", "o:6.5,6.5,2.5", "o:17.5,17.5,2.5"]);

// ---- people and access
export const user = /* @__PURE__ */ i("user", ["o:12,8,4", "M4 21a8 8 0 0 1 16 0"]);
export const users = /* @__PURE__ */ i("users", ["o:9,8,3.5", "M2.5 20a6.5 6.5 0 0 1 13 0", "M16 4.6a3.5 3.5 0 0 1 0 6.8", "M18 14a6.5 6.5 0 0 1 3.5 6"]);
export const userCheck = /* @__PURE__ */ i("user-check", ["o:10,8,4", "M3 21a7 7 0 0 1 11-5.7", "m16 19 2 2 4-4"]);
export const idCard = /* @__PURE__ */ i("id-card", ["b:2,5,20,14,2", "o:8,11,2", "M5 16a3 3 0 0 1 6 0", "M14 10h5", "M14 14h4"]);
export const crown = /* @__PURE__ */ i("crown", ["M2.5 7.5 7 12l5-7 5 7 4.5-4.5L19 18H5z", "M5 21h14"]);
export const shield = /* @__PURE__ */ i("shield", ["M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z"]);
export const shieldCheck = /* @__PURE__ */ i("shield-check", ["M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6z", "m9 12 2 2 4-4"]);
export const lock = /* @__PURE__ */ i("lock", ["b:4,11,16,10,2", "M8 11V7a4 4 0 0 1 8 0v4"]);
export const key = /* @__PURE__ */ i("key", ["o:7.5,15.5,4.5", "M10.7 12.3 20 3", "m17 6 3 3", "m14.5 8.5 2.5 2.5"]);
export const badgeCheck = /* @__PURE__ */ i("badge-check", ["M12 2l2.4 2.1 3.2-.3.7 3.1 2.8 1.6-1.3 2.9 1.3 2.9-2.8 1.6-.7 3.1-3.2-.3L12 22l-2.4-2.1-3.2.3-.7-3.1-2.8-1.6L4.2 12 2.9 9.1l2.8-1.6.7-3.1 3.2.3z", "m9 12 2 2 4-4"]);
export const smile = /* @__PURE__ */ i("smile", ["o:12,12,9", "M8 14s1.5 2 4 2 4-2 4-2", "M9 9h.01", "M15 9h.01"]);

// ---- communication
export const mail = /* @__PURE__ */ i("mail", ["b:2.5,5,19,14,2", "m3 7 9 6 9-6"]);
export const message = /* @__PURE__ */ i("message", ["M21 12a8.5 8.5 0 0 1-12.3 7.6L3 21l1.4-5.4A8.5 8.5 0 1 1 21 12z"]);
export const phone = /* @__PURE__ */ i("phone", ["b:6,2,12,20,2.5", "M11 18h2"]);
export const megaphone = /* @__PURE__ */ i("megaphone", ["m3 11 15-6v14L3 13z", "M11.6 16.8a3 3 0 1 1-5.8-1.6"]);
export const headphones = /* @__PURE__ */ i("headphones", ["M3 18v-6a9 9 0 0 1 18 0v6", "M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3z", "M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"]);
export const globe = /* @__PURE__ */ i("globe", ["o:12,12,9", "M3 12h18", "M12 3a14 14 0 0 1 0 18", "M12 3a14 14 0 0 0 0 18"]);

// ---- money and commerce
export const wallet = /* @__PURE__ */ i("wallet", ["M3 5v14a2 2 0 0 0 2 2h15V7H5a2 2 0 0 1-2-2 2 2 0 0 1 2-2h12v4", "o:16,14,1"]);
export const coins = /* @__PURE__ */ i("coins", ["o:9,9,6", "M15 9.2a6 6 0 1 1-5.8 5.8"]);
export const banknote = /* @__PURE__ */ i("banknote", ["b:2,6,20,12,2", "o:12,12,2.5", "M6 12h.01", "M18 12h.01"]);
export const creditCard = /* @__PURE__ */ i("credit-card", ["b:2.5,5,19,14,2", "M2.5 10h19", "M6 15h4"]);
export const receipt = /* @__PURE__ */ i("receipt", ["M5 2v20l2.5-1.5L10 22l2-1.5 2 1.5 2.5-1.5L19 22V2l-2.5 1.5L14 2l-2 1.5L10 2 7.5 3.5z", "M9 8h6", "M9 12h6", "M9 16h4"]);
export const diamond = /* @__PURE__ */ i("diamond", ["M6 3h12l4 6-10 12L2 9z", "M2 9h20", "M12 21 8 9l2-6", "M12 21l4-12-2-6"]);
export const shoppingBag = /* @__PURE__ */ i("shopping-bag", ["M5 7h14l-1 14H6z", "M9 10V6a3 3 0 0 1 6 0v4"]);
export const store = /* @__PURE__ */ i("store", ["M4 9.5 5.5 4h13L20 9.5", "M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0", "M5 12v8h14v-8", "M10 20v-5h4v5"]);
export const packageBox = /* @__PURE__ */ i("package", ["M21 8 12 3 3 8v8l9 5 9-5z", "M3 8l9 5 9-5", "M12 13v8", "m7.5 5.5 9 5"]);
export const truck = /* @__PURE__ */ i("truck", ["M14 16.5V6H3v10.5", "M14 9h4l3 3.5v4", "o:7,17.5,2", "o:17,17.5,2"]);
export const gift = /* @__PURE__ */ i("gift", ["b:3,8,18,4,1", "M5 12v9h14v-9", "M12 8v13", "M12 8S10.5 3 8 4s.5 4 4 4", "M12 8s1.5-5 4-4-.5 4-4 4"]);
export const ticket = /* @__PURE__ */ i("ticket", ["M2 9a3 3 0 0 0 0 6v3a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-3a3 3 0 0 0 0-6V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z", "M13 5v2", "M13 11v2", "M13 17v2"]);
export const trophy = /* @__PURE__ */ i("trophy", ["M8 21h8", "M12 17v4", "M7 4h10v5a5 5 0 0 1-10 0z", "M17 5h3v2a3 3 0 0 1-3 3", "M7 5H4v2a3 3 0 0 0 3 3"]);
export const heart = /* @__PURE__ */ i("heart", ["M12 20s-8-4.6-8-10.2A4.3 4.3 0 0 1 12 7.5a4.3 4.3 0 0 1 8 2.3C20 15.4 12 20 12 20z"]);
export const coffee = /* @__PURE__ */ i("coffee", ["M17 8h1a4 4 0 0 1 0 8h-1", "M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4z", "M6 2v3", "M10 2v3", "M14 2v3"]);

// ---- media and content
export const image = /* @__PURE__ */ i("image", ["b:3,3,18,18,2.5", "o:9,9,2", "m21 15-5-5L5 21"]);
export const video = /* @__PURE__ */ i("video", ["b:2,6,14,12,2", "m16 10 6-3.5v11L16 14"]);
export const film = /* @__PURE__ */ i("film", ["b:3,3,18,18,2", "M7 3v18", "M17 3v18", "M3 8h4", "M3 16h4", "M17 8h4", "M17 16h4", "M3 12h18"]);
export const music = /* @__PURE__ */ i("music", ["M9 18V5l12-2v13", "o:6,18,3", "o:18,16,3"]);
export const mic = /* @__PURE__ */ i("mic", ["b:9,2,6,12,3", "M5 10v1a7 7 0 0 0 14 0v-1", "M12 18v4"]);
export const radio = /* @__PURE__ */ i("radio", ["o:12,12,2", "M16.2 7.8a6 6 0 0 1 0 8.4", "M7.8 16.2a6 6 0 0 1 0-8.4", "M19 5a10 10 0 0 1 0 14", "M5 19A10 10 0 0 1 5 5"]);
export const book = /* @__PURE__ */ i("book", ["M4 19V5a2 2 0 0 1 2-2h14v14H6a2 2 0 0 0 0 4h14"]);
export const graduation = /* @__PURE__ */ i("graduation", ["M22 9 12 4 2 9l10 5z", "M6 11v5c3 2.5 9 2.5 12 0v-5", "M22 9v6"]);
export const folder = /* @__PURE__ */ i("folder", ["M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"]);
export const fileText = /* @__PURE__ */ i("file-text", ["M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z", "M14 3v6h6", "M8 13h8", "M8 17h5"]);
export const clipboard = /* @__PURE__ */ i("clipboard", ["b:8,2,8,4,1", "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2", "m9 14 2 2 4-4"]);
export const lightbulb = /* @__PURE__ */ i("lightbulb", ["M9 18h6", "M10 22h4", "M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"]);
export const gamepad = /* @__PURE__ */ i("gamepad", ["M6 12h4", "M8 10v4", "M15 13h.01", "M18 11h.01", "M17.3 5H6.7a4 4 0 0 0-4 3.6L2 15a3 3 0 0 0 5.2 2.1L9 15h6l1.8 2.1A3 3 0 0 0 22 15l-.7-6.4a4 4 0 0 0-4-3.6z"]);
export const palette = /* @__PURE__ */ i("palette", ["M12 3a9 9 0 0 0 0 18c1.1 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z", "o:7.5,11.5,1", "o:10.5,7.5,1", "o:15,7.5,1"]);
export const droplet = /* @__PURE__ */ i("droplet", ["M12 3.2s6.2 6.6 6.2 11.1a6.2 6.2 0 0 1-12.4 0C5.8 9.8 12 3.2 12 3.2z"]);
export const compass = /* @__PURE__ */ i("compass", ["o:12,12,9", "m15.5 8.5-2 5-5 2 2-5z"]);
export const home = /* @__PURE__ */ i("home", ["M3 10.5 12 3l9 7.5", "M5 9v12h14V9", "M10 21v-6h4v6"]);
export const mapPin = /* @__PURE__ */ i("map-pin", ["M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z", "o:12,10,3"]);

// ---- tech
export const code = /* @__PURE__ */ i("code", ["m16 18 6-6-6-6", "m8 6-6 6 6 6"]);
export const terminal = /* @__PURE__ */ i("terminal", ["m4 17 6-5-6-5", "M12 19h8"]);
export const server = /* @__PURE__ */ i("server", ["b:3,3,18,8,2", "b:3,13,18,8,2", "M7 7h.01", "M7 17h.01"]);
export const database = /* @__PURE__ */ i("database", ["M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3", "M4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6", "M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"]);
export const cloud = /* @__PURE__ */ i("cloud", ["M7 19a5 5 0 0 1-.5-10A6.5 6.5 0 0 1 19 10.5 4.3 4.3 0 0 1 17.5 19z"]);
export const plug = /* @__PURE__ */ i("plug", ["M9 2v6", "M15 2v6", "M6 8h12v3a6 6 0 0 1-12 0z", "M12 17v5"]);
export const cpu = /* @__PURE__ */ i("cpu", ["b:5,5,14,14,2", "b:9,9,6,6,1", "M9 2v3", "M15 2v3", "M9 19v3", "M15 19v3", "M2 9h3", "M2 15h3", "M19 9h3", "M19 15h3"]);
export const bot = /* @__PURE__ */ i("bot", ["b:4,8,16,12,3", "M12 8V4.5", "o:12,3.5,1", "M9 13v2", "M15 13v2", "M2 13v3", "M22 13v3"]);
export const bug = /* @__PURE__ */ i("bug", ["b:7,7,10,14,5", "M9 7V5a3 3 0 0 1 6 0v2", "M3 13h4", "M17 13h4", "M4 8l3 2", "M20 8l-3 2", "M4 20l3-3", "M20 20l-3-3", "M12 11v10"]);
export const flask = /* @__PURE__ */ i("flask", ["M9 3h6", "M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3", "M7 15h10"]);
export const building = /* @__PURE__ */ i("building", ["b:4,3,16,18,2", "M9 21v-4h6v4", "M8 7h.01", "M12 7h.01", "M16 7h.01", "M8 11h.01", "M12 11h.01", "M16 11h.01"]);
export const scale = /* @__PURE__ */ i("scale", ["M12 4v17", "M8 21h8", "M4 7h16", "M4 7 1.5 13.5a2.5 2.5 0 0 0 5 0z", "M20 7l-2.5 6.5a2.5 2.5 0 0 0 5 0z"]);
