import prisma from '../../config/prisma-client';
import SafeCallback from '../../utils/safe-callback';

export default async function GetCdn(user_id: string) {
  const cdn = await SafeCallback(() =>
    prisma.cdn.findMany({
      where: {
        user_id,
        status: 'ACTIVE',
      },
      select: {
        url: true,
      },
    })
  );
  return cdn ? cdn.map(({ url }) => url) : [];
}
