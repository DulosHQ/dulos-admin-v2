/**
 * Send emails via Gmail API using Google Service Account
 * Uses domain-wide delegation to impersonate vulkimi.testeo@vulkn-ai.com
 */

import { google } from 'googleapis';
import { inviteEmailHTML } from './email-templates';

const IMPERSONATE_EMAIL = 'vulkimi.testeo@vulkn-ai.com';

// Service account credentials for email sending
// Same pattern as SUPABASE_SERVICE_ROLE_KEY (hardcoded fallback in private repo)
function getCredentials() {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON) {
    return JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON);
  }
  return {
    type: 'service_account',
    project_id: 'hq-vulkn',
    private_key_id: 'ae61bdf497bd13176b48ab8bc1801d2b754793c3',
    private_key: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCjC+UnFlYNjtvJ\n0odwGjxOKP0gKxA+NrgShtDmAJDf4R8BVidcKBA5MqnBHJcOVF4dDrjECccRYGza\n7l0u5bV2z9+OXU5j53esirNwzj9jUCoMnvfLiLsQ29iZ0Edsnj7HPQhNFQ8q55m2\n86sKQtTCVfYLsZb96687WdR3AD77LWUAzT2hCBpj2wTmzIzt8CDrhtisvfk2xdJC\ndpkUdIHLXEzYc80gC5MEEsptE3PSrJq00dmkn6iSrcTmlNpzAzbc1Grz0NZBDIgL\n5gKSHiY1t/I/VbbeODOZnCsNjf9CvoFxkHJO9dvV3OnKyQarwwVHxZc7cqf3QZKh\nwd8wfwKPAgMBAAECggEAN/OrDcDSgxCVSCshI009iKz0QIfGqTLp9CGjqmpjTRDa\nLQE9vJhbCOXj70s6Y0Z8jYgxy8R3NfVbJb5K5/8YSM+JLjfC4PHb1bA7Z+i/Q/uM\nkowzCPvBBkYLjK029YVQkdrV8G3bqKOV0nzII1tP2+jX6Kdm43hvx/RJvxSsiFE9\nbRE8Q7GS3+M7qhFclWEON/5wczNLnAAeDde/CoIc5sv7hkumFXxjSyDV+LxevPkj\nmTk0lqLvJ9dFceDGqDP/oDxv28o9jCwukjlUIAfA65eWZgJo1MQIHKf8/Pb1vFWm\nGVMAE6gdFxfhyDmoQ3v8VvdQtE2ORh9FYAiaEY9oUQKBgQDPdh2D+py+fkGvx45G\nGqEr4+hcslaEpJ5+OdbmjuBDJ2CbTQmTCRY2DaZ5Va+q1JBojfVyQz4YUwdK+9ju\nAod5YzC39X1Zr4Vl8gtgYGtl6fkW+ASETCt0lF5MkLr299GR3Xk8TbELUlPOVPp6\nr4Pay49KWlXKdk77P8XISAzHpQKBgQDJMY0hBLd1SWcGhSdMdn8zwpA0hVK6uE/f\nkKDTWNTWboTxsfGiAIdlZDKds+ZgATr9yWA98tv0P9mvMsMciDhyXle6o+CBNT0o\nuJ98AClZeIUTz3JbiQwqwzhXUSM6VvPrg952g/ENFFwW7bhSa7RjbyAy1vqkUes+\nZk96nqsrIwKBgQCJqFhBYKNtCx3O410WS0kydFGUYIlkDk9UdlCQP7GzHYfOxLlb\npSXly/zwedjMQ6tmlPuOS+wB++XU7XOtymPWOejzx6LbRcoAMTE3TAM3Zp7vjLaC\nioAzJNfFeit1AE9AuHJffzXAy2nseRqTGa8mGPgFYBeY9hPGRzSXhqdkOQKBgCL1\nDBtvkVy8mz0Dx7c+Y42fwaSOgbhVq/MhUwBFz/1OCKViEKTgSKYySaUjC+UkcZaE\n9cbtuo/uxCjvvfzoIj6k68NPFAP/NxgrM/K8qHKWQTEW+zyyTD3l25U4UNGjKBCE\nwhN/i1OFdRa6ySrw8c/REBwlRDlmzmPyLN8WUJFXAoGBAJSbgi4GwrFuidyzDmw6\nUorBUDW+OlShosy/PMOJfTIo/x7tMycKmfUKamCrhQUkv6avQQQV0Pjjj48XEkNW\n5ISD2ydtgQ+4n2LYkUhlMq+jSitEU1Rp9P+3FyRDlU2+pash+vAHKdpDUhurYpPG\nWh3OlzfCeYIUiBg7uoGEJIba\n-----END PRIVATE KEY-----\n',
    client_email: 'vulkn-agents@hq-vulkn.iam.gserviceaccount.com',
    client_id: '112686295089031758606',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: 'https://www.googleapis.com/robot/v1/metadata/x509/vulkn-agents%40hq-vulkn.iam.gserviceaccount.com',
    universe_domain: 'googleapis.com',
  };
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Administrador',
  operator: 'Operador',
  analyst: 'Analista',
  taquillero: 'Taquillero',
};

async function getGmailClient() {
  const credentials = getCredentials();
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/gmail.send'],
    clientOptions: { subject: IMPERSONATE_EMAIL },
  });
  return google.gmail({ version: 'v1', auth });
}

export async function sendInviteEmail({
  to,
  name,
  role,
}: {
  to: string;
  name: string;
  role: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const gmail = await getGmailClient();
    const displayRole = ROLE_LABELS[role] || role;
    const html = inviteEmailHTML({
      name,
      role,
      loginUrl: 'https://dulos-admin-v2.vercel.app/login',
    });

    const subject = `🎫 Bienvenido a Dulos — Tu acceso como ${displayRole}`;
    const boundary = 'dulos_boundary_' + Date.now();

    const mimeMessage = [
      `From: "Dulos Entertainment" <${IMPERSONATE_EMAIL}>`,
      `To: ${name} <${to}>`,
      `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      '',
      `¡Hola ${name}! Has sido invitado al equipo de Dulos Entertainment como ${displayRole}. Accede aquí: https://dulos-admin-v2.vercel.app/login`,
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(html).toString('base64').replace(/(.{76})/g, '$1\n'),
      '',
      `--${boundary}--`,
    ].join('\r\n');

    const encodedMessage = Buffer.from(mimeMessage)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await gmail.users.messages.send({
      userId: 'me',
      requestBody: { raw: encodedMessage },
    });

    return { success: true, messageId: result.data.id || undefined };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('sendInviteEmail error:', msg);
    return { success: false, error: msg };
  }
}
