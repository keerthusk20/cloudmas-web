// netlify/functions/contact-us.js
import mongoose from "mongoose";
import nodemailer from "nodemailer";

let isConnected = false;

const connectDB = async () => {
  if (isConnected) return;
  await mongoose.connect(process.env.MONGO_URL);
  isConnected = true;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
};

exports.handler = async (event, context) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: "Method not allowed" })
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { name, company, email, source, message } = body;

    await connectDB();

    const contactSchema = new mongoose.Schema({
      name: String,
      company: String,
      email: String,
      source: String,
      message: String
    }, { timestamps: true });

    const Contact = mongoose.model("Contact", contactSchema, "contacts");
    await Contact.create({ name, company, email, source, message });

    const transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT),
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

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

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Message sent successfully" })
    };

  } catch (err) {
    console.error("Contact Error:", err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ message: "Server error" })
    };
  }
};
