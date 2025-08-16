import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail", // or smtp config
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false, // 👈 ignore invalid certs
  },
});

async function sendEmail({
  to = "baldwinrellora18@gmail.com",
  subject = "STUDENT TIME IN",
  text = `Student was safely arrived at school at ${new Date().toLocaleString()}` ,
}: {
  to?: string;
  subject?: string;
  text?: string;
}) {
  return transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    text,
  });
}

export async function POST(req: Request) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  console.log("EMAIL_USER:", process.env.EMAIL_USER);
console.log("EMAIL_PASS exists:", !!process.env.EMAIL_PASS);

  const body = await req.json();

  try {
    const now = new Date();
    const info = await sendEmail(body);
    return NextResponse.json({ success: true, info });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: String(err) + process.env.EMAIL_USER + process.env.EMAIL_PASS }, { status: 500 });
  }
}
