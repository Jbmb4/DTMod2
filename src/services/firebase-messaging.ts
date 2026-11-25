import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';

const FCM_SCOPE = 'https://www.googleapis.com/auth/firebase.messaging';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

export type PushNotificationInput = {
  token: string;
  title: string;
  message: string;
  imageUrl?: string;
};

type ServiceAccount = {
  project_id: string;
  client_email: string;
  private_key: string;
};

type CachedAccessToken = {
  accessToken: string;
  expiresAt: number;
};

let cachedAccessToken: CachedAccessToken | null = null;

function readServiceAccount(): ServiceAccount {
  const keyFile =
    process.env.FIREBASE_SERVICE_ACCOUNT_FILE?.trim() || process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  if (!keyFile) {
    throw new Error(
      'Configure FIREBASE_SERVICE_ACCOUNT_FILE com o caminho do JSON privado da conta de serviço Firebase.'
    );
  }

  let account: Partial<ServiceAccount>;
  try {
    account = JSON.parse(readFileSync(keyFile, 'utf8')) as Partial<ServiceAccount>;
  } catch {
    throw new Error('Não foi possível ler a credencial Firebase no caminho configurado no servidor.');
  }

  if (!account.project_id || !account.client_email || !account.private_key) {
    throw new Error('O arquivo da conta de serviço Firebase está incompleto.');
  }

  const configuredProject = process.env.FIREBASE_PROJECT_ID?.trim();
  if (configuredProject && configuredProject !== account.project_id) {
    throw new Error('FIREBASE_PROJECT_ID precisa ser igual ao project_id do JSON da conta de serviço.');
  }

  return account as ServiceAccount;
}

export function isFirebaseConfigured(): boolean {
  try {
    readServiceAccount();
    return true;
  } catch {
    return false;
  }
}

function base64Url(value: string | Buffer): string {
  return Buffer.from(value).toString('base64url');
}

async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 60_000) {
    return cachedAccessToken.accessToken;
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const jwtHeader = base64Url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const jwtClaims = base64Url(
    JSON.stringify({
      iss: account.client_email,
      scope: FCM_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    })
  );
  const unsignedJwt = `${jwtHeader}.${jwtClaims}`;
  const signer = createSign('RSA-SHA256');
  signer.update(unsignedJwt);
  signer.end();
  const assertion = `${unsignedJwt}.${signer.sign(account.private_key).toString('base64url')}`;

  const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  const tokenData = (await tokenResponse.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  };

  if (!tokenResponse.ok || !tokenData.access_token) {
    throw new Error(tokenData.error_description || 'O Google recusou a autenticação da conta de serviço Firebase.');
  }

  cachedAccessToken = {
    accessToken: tokenData.access_token,
    expiresAt: Date.now() + Math.max(60, tokenData.expires_in ?? 3600) * 1000,
  };
  return cachedAccessToken.accessToken;
}

export async function sendFirebaseNotification(input: PushNotificationInput): Promise<string> {
  const account = readServiceAccount();
  const accessToken = await getAccessToken(account);
  const imageUrl = input.imageUrl?.trim();
  const notification = {
    title: input.title,
    body: input.message,
    ...(imageUrl ? { image: imageUrl } : {}),
  };
  const data = {
    title: input.title,
    message: input.message,
    ...(imageUrl ? { image: imageUrl } : {}),
  };

  const response = await fetch(
    `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(account.project_id)}/messages:send`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          token: input.token,
          notification,
          data,
          android: {
            priority: 'HIGH',
            notification: imageUrl ? { image: imageUrl } : {},
          },
        },
      }),
    }
  );
  const result = (await response.json().catch(() => ({}))) as {
    name?: string;
    error?: { message?: string };
  };

  if (!response.ok || !result.name) {
    const details = result.error?.message;
    throw new Error(details || `O FCM não aceitou a mensagem (HTTP ${response.status}).`);
  }

  return result.name;
}
