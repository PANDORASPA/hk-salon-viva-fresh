const service = (name, pricePence, category, durationMinutes, description = "") => ({
  name,
  pricePence,
  category,
  durationMinutes,
  description,
});

const salonDefaults = {
  identity: {
    name: "SALON POKE BY VIVA",
    shortName: "SALON POKE",
    tagline: "爆毛術脫髮護理",
    eyebrow: "香港 · 敬請預約",
    heroTitle: "亞洲人髮絲專家",
    heroBody:
      "超過20年專業經驗，專精剪髮、染髮、電髮、離子夾及頭髮修護。我們專注為亞洲髮質提供量身訂造的護理方案，在私密的香港市中心工作室為你服務。",
  },
  contact: {
    whatsapp: "852XXXXXXXX",
    phone: "852XXXXXXXX",
    email: "info@salonpokeviva.com",
    instagram: "",
    area: "香港",
    addressNote: "確實地址於預約確認後以 WhatsApp 發送",
  },
  business: {
    openDays: "星期一至六",
    hours: "10:00 – 19:00",
    closedDays: "星期日及公眾假期休息",
  },
};

const defaultServices = [
  service("創意剪髮", 48000, "剪髮", 60, "個人化剪裁造型"),
  service("深層護理", 28000, "護理", 45, "深層滋潤受損髮質"),
  service("電髮", 68000, "電髮", 120, "離子燙或數碼燙"),
  service("染髮", 58000, "染髮", 90, "全染或漂染"),
  service("頭髮增髮", 88000, "增髮", 90, "爆毛術增髮護理"),
  service("脫髮評估", 18000, "諮詢", 30, "專業脫髮評估及建議"),
];

module.exports = { salonDefaults, defaultServices };
