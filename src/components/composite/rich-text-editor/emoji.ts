// Emoji suggestions of RichTextEditor (":gul" → 😄): [emoji, English shortcode, Turkish keywords]. A short, common
// set; pass `emoji={list}` for another one.
export type EmojiEntry = readonly [emoji: string, name: string, keywords: string];

export const EMOJI: readonly EmojiEntry[] = [
  ["😀", "grinning", "gülümse mutlu sırıt"], ["😄", "smile", "gül gülümse mutlu"], ["😂", "joy", "kahkaha gözyaşı komik"], ["🤣", "rofl", "yerlere yat gül"],
  ["😊", "blush", "utangaç mutlu"], ["😍", "heart_eyes", "aşık bayıl"], ["🥰", "smiling_hearts", "sevgi kalp"], ["😘", "kiss", "öpücük"],
  ["😉", "wink", "göz kırp"], ["😎", "sunglasses", "havalı gözlük"], ["🤩", "star_struck", "hayran yıldız"], ["🥳", "party", "parti kutlama"],
  ["🤔", "thinking", "düşün hmm"], ["🙄", "eye_roll", "göz devir"], ["😅", "sweat_smile", "ter mahcup"], ["😇", "innocent", "melek masum"],
  ["😐", "neutral", "nötr ifadesiz"], ["😴", "sleeping", "uyku uyu"], ["😢", "cry", "ağla üzgün"], ["😭", "sob", "hüngür ağla"],
  ["😡", "rage", "kızgın öfke"], ["😱", "scream", "çığlık korku"], ["🤯", "mind_blown", "beyin patla şaşkın"], ["😬", "grimace", "gergin"],
  ["🤗", "hug", "sarıl kucak"], ["🤝", "handshake", "anlaşma tokalaş"], ["👍", "thumbsup", "beğen tamam onay"], ["👎", "thumbsdown", "beğenme"],
  ["👏", "clap", "alkış tebrik"], ["🙌", "raised_hands", "yaşasın eller"], ["🙏", "pray", "lütfen teşekkür dua"], ["💪", "muscle", "güç kas güçlü"],
  ["👋", "wave", "selam merhaba el salla"], ["✌️", "v", "barış zafer"], ["👌", "ok_hand", "tamam süper"], ["🤞", "crossed_fingers", "şans umut"],
  ["👀", "eyes", "bak göz"], ["🧠", "brain", "beyin akıl"], ["❤️", "heart", "kalp sevgi aşk"], ["🧡", "orange_heart", "turuncu kalp heyecan"],
  ["💙", "blue_heart", "mavi kalp aktivite"], ["💚", "green_heart", "yeşil kalp dostluk"], ["💜", "purple_heart", "mor kalp iletişim"], ["💔", "broken_heart", "kırık kalp"],
  ["🔥", "fire", "ateş harika yangın"], ["✨", "sparkles", "parıltı yeni"], ["⭐", "star", "yıldız"], ["🌟", "glowing_star", "parlak yıldız"],
  ["⚡", "zap", "şimşek hızlı enerji"], ["💯", "100", "yüz tam puan"], ["✅", "white_check_mark", "tamam bitti onay"], ["❌", "x", "hayır iptal yanlış"],
  ["⚠️", "warning", "uyarı dikkat"], ["❓", "question", "soru"], ["❗", "exclamation", "ünlem önemli"], ["💡", "bulb", "fikir ampul"],
  ["🎉", "tada", "kutlama konfeti tebrik"], ["🎊", "confetti", "konfeti"], ["🎁", "gift", "hediye"], ["🎂", "cake", "pasta doğum günü"],
  ["🏆", "trophy", "kupa ödül"], ["🥇", "first_place", "birinci altın madalya"], ["🎯", "dart", "hedef"], ["🚀", "rocket", "roket başlat yayın"],
  ["📌", "pushpin", "iğne sabitle"], ["📎", "paperclip", "ataş ek"], ["📝", "memo", "not yaz"], ["📅", "calendar", "takvim tarih"],
  ["⏰", "alarm", "saat alarm"], ["⌛", "hourglass", "kum saati bekle"], ["📈", "chart_up", "artış grafik"], ["📉", "chart_down", "düşüş grafik"],
  ["💬", "speech", "konuşma mesaj"], ["📣", "mega", "duyuru megafon"], ["🔔", "bell", "zil bildirim"], ["📧", "email", "e-posta posta"],
  ["🔒", "lock", "kilit güvenli"], ["🔑", "key", "anahtar"], ["🛠️", "tools", "araç tamir"], ["🐛", "bug", "hata böcek"],
  ["💻", "computer", "bilgisayar"], ["📱", "phone", "telefon mobil"], ["🌍", "earth", "dünya küre"], ["☀️", "sun", "güneş"],
  ["🌙", "moon", "ay gece"], ["🌈", "rainbow", "gökkuşağı"], ["☕", "coffee", "kahve"], ["🍕", "pizza", "pizza"],
  ["🍎", "apple", "elma"], ["🐱", "cat", "kedi"], ["🐶", "dog", "köpek"], ["🦊", "fox", "tilki"],
  ["⚽", "soccer", "futbol top"], ["🎮", "game", "oyun"], ["🎵", "music", "müzik nota"], ["📷", "camera", "kamera fotoğraf"],
];

/** Shown at once for a lone ":" (by shortcode, in this order). */
export const POPULAR_EMOJI: readonly string[] = ["smile", "joy", "heart_eyes", "thumbsup", "heart", "fire", "tada", "clap", "pray", "thinking", "wink", "rocket"];
