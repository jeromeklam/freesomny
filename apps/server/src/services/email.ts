import nodemailer from 'nodemailer'

function getSmtpConfig() {
  const host = process.env.SMTP_HOST
  const port = parseInt(process.env.SMTP_PORT || '25', 10)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS
  const from = process.env.SMTP_FROM || 'noreply@freesomnia.local'

  if (!host) {
    return null
  }

  return { host, port, user: user || null, pass: pass || null, from }
}

function createTransporter(smtp: NonNullable<ReturnType<typeof getSmtpConfig>>) {
  const options: Record<string, unknown> = {
    host: smtp.host,
    port: smtp.port,
    secure: smtp.port === 465,
  }

  if (smtp.user && smtp.pass) {
    options.auth = { user: smtp.user, pass: smtp.pass }
  } else {
    // Unauthenticated SMTP (e.g. port 25 relay)
    options.tls = { rejectUnauthorized: false }
  }

  return nodemailer.createTransport(options)
}

export function isSmtpConfigured(): boolean {
  return getSmtpConfig() !== null
}

export async function sendVerificationEmail(
  email: string,
  verifyUrl: string
): Promise<{ sent: boolean; consoleOnly: boolean }> {
  const smtp = getSmtpConfig()

  if (!smtp) {
    console.log('═══════════════════════════════════════════')
    console.log('  EMAIL VERIFICATION LINK (SMTP not configured)')
    console.log(`  Email: ${email}`)
    console.log(`  Link:  ${verifyUrl}`)
    console.log('═══════════════════════════════════════════')
    return { sent: true, consoleOnly: true }
  }

  const transporter = createTransporter(smtp)

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: 'FreeSomnia — Verify Your Email',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e293b;">Welcome to FreeSomnia!</h2>
        <p style="color: #475569;">Thank you for registering. Please verify your email address by clicking the button below.</p>
        <a href="${verifyUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Verify Email
        </a>
        <p style="color: #475569;">After verification, an administrator will need to approve your account before you can log in.</p>
        <p style="color: #94a3b8; font-size: 13px;">This link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">FreeSomnia — API Client</p>
      </div>
    `,
  })

  return { sent: true, consoleOnly: false }
}

export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string
): Promise<{ sent: boolean; consoleOnly: boolean }> {
  const smtp = getSmtpConfig()

  if (!smtp) {
    // Fallback: log to console
    console.log('═══════════════════════════════════════════')
    console.log('  PASSWORD RESET LINK (SMTP not configured)')
    console.log(`  Email: ${email}`)
    console.log(`  Link:  ${resetUrl}`)
    console.log('═══════════════════════════════════════════')
    return { sent: true, consoleOnly: true }
  }

  const transporter = createTransporter(smtp)

  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: 'FreeSomnia — Password Reset',
    html: `
      <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #1e293b;">Password Reset</h2>
        <p style="color: #475569;">You requested a password reset for your FreeSomnia account.</p>
        <p style="color: #475569;">Click the button below to set a new password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display: inline-block; margin: 16px 0; padding: 12px 24px; background: #2563eb; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Reset Password
        </a>
        <p style="color: #94a3b8; font-size: 13px;">If you didn't request this, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 24px 0;" />
        <p style="color: #94a3b8; font-size: 12px;">FreeSomnia — API Client</p>
      </div>
    `,
  })

  return { sent: true, consoleOnly: false }
}
