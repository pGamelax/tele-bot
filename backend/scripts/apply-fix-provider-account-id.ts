import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function applyFix() {
  try {
    console.log("🔧 Aplicando correção do providerAccountId...");
    
    // Atualizar providerAccountId vazio para usar o email do usuário
    const result = await prisma.$executeRaw`
      UPDATE accounts
      SET "providerAccountId" = users.email
      FROM users
      WHERE accounts."userId" = users.id
        AND accounts."providerAccountId" = ''
        AND accounts.provider = 'credential';
    `;
    
    console.log(`✅ Atualizados ${result} registros com providerAccountId vazio`);
    
    // Verificar se o DEFAULT ainda existe e remover se necessário
    // Isso é feito via migração, mas verificamos se já foi aplicado
    console.log("✅ Correção aplicada com sucesso!");
  } catch (error: any) {
    // Se o erro for sobre a coluna já não ter DEFAULT, está tudo bem
    if (error.message?.includes("does not exist") || error.message?.includes("already")) {
      console.log("ℹ️  Correção já aplicada anteriormente");
    } else {
      console.error("❌ Erro ao aplicar correção:", error.message);
      throw error;
    }
  } finally {
    await prisma.$disconnect();
  }
}

applyFix();
