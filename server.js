import express from "express";
import cors from "cors";
import nodemailer from "nodemailer";
import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();
const app = express();

app.use(express.json());

// FIXED: Allow all origins in development, specific origins in production
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:8080",
      "http://localhost:5173",
      "http://localhost:3000",
      "https://offerbunch.in",
      "https://www.offerbunch.in",
      "https://api.offerbunch.in"
    ];
    
    // Allow any lovable.app preview URLs
    if (origin.includes("lovable.app") || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    callback(null, true); // Allow all for development
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true
}));

mongoose.connect(process.env.MONGO_URL)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB connection error:", err));

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: Number(process.env.EMAIL_PORT),
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

transporter.verify(err => {
  if (err) console.error("❌ SMTP ERROR:", err);
  else console.log("✅ SMTP Ready");
});

const bookingSchema = new mongoose.Schema({
  name: String,
  company: String,
  email: String,
  phone: String,
  date: String,
  time: String
}, { timestamps: true });

bookingSchema.index({ email: 1, date: 1 }, { unique: true });
const Booking = mongoose.model("Booking", bookingSchema);

const contactSchema = new mongoose.Schema({
  name: String,
  company: String,
  email: String,
  source: String,
  message: String
}, { timestamps: true });

const Contact = mongoose.model("Contact", contactSchema);

app.post("/api/free-consultation", async (req, res) => {
  try {
    const { name, company, email, phone, date, time } = req.body;

    if (!name || !company || !email || !phone || !date || !time) {
      return res.status(400).json({ message: "All fields are required" });
    }

    await Booking.create({ name, company, email, phone, date, time });

    await Promise.all([
      transporter.sendMail({
        from: `"CloudMaSa Booking" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: "📅 New Free Consultation Booking",
        html: `<h2>New Consultation</h2><p><b>Name:</b> ${name}</p><p><b>Company:</b> ${company}</p><p><b>Email:</b> ${email}</p><p><b>Phone:</b> ${phone}</p><p><b>Date:</b> ${date}</p><p><b>Time:</b> ${time}</p>`
      }),
      transporter.sendMail({
        from: `"CloudMaSa Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "✅ Free Consultation Confirmed",
        html: `<p>Hi ${name},</p><p>Your free consultation is confirmed.</p><p><b>Date:</b> ${date}</p><p><b>Time:</b> ${time}</p><p>— CloudMaSa Team</p>`
      })
    ]);

    res.status(200).json({ message: "Consultation booked successfully" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "You already booked a consultation for this date" });
    }
    console.error("Free Consultation Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/api/contact-us", async (req, res) => {
  try {
    const { name, company, email, source, message } = req.body;

    await Contact.create({ name, company, email, source, message });

    await Promise.all([
      transporter.sendMail({
        from: `"CloudMaSa Contact" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: "📩 New Contact Request",
        html: `<h2>New Contact</h2><p><b>Name:</b> ${name}</p><p><b>Company:</b> ${company}</p><p><b>Email:</b> ${email}</p><p><b>Source:</b> ${source}</p><p><b>Message:</b> ${message}</p>`
      }),
      transporter.sendMail({
        from: `"CloudMaSa Team" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "✅ We received your message",
        html: `<p>Thank you ${name}, we will contact you shortly.</p>`
      })
    ]);

    res.status(200).json({ message: "Message sent successfully" });
  } catch (err) {
    console.error("Contact Error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on port ${PORT}`));
