export async function getSubdomain(zafClient: any): Promise<string> {
  try {
    const context = await zafClient.context();
    return context.account.subdomain;
  } catch (error) {
    console.error('Error getting subdomain:', error);
    throw error;
  }
}
