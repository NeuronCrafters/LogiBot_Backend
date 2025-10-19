#!/bin/bash

# =================================================================
# CONFIGURAÇÕES DO MONGODB (AJUSTE O 'MONGO_HOST' SE NECESSÁRIO)
# =================================================================
MONGO_HOST="localhost"      # Mantenha 'localhost' se a porta 27017 estiver mapeada para a VPS.
                            # Se estiver em outro container, use o nome do serviço (ex: 'mongodb').
MONGO_PORT="27017"          # Porta padrão.
MONGO_DATABASE="logibot_db" # Nome da base de dados
MONGO_USER="chatsael"       # Usuário administrativo (MONGO_USER_ADMIN)
MONGO_PASSWORD="chatsael_password" # Senha (MONGO_PASSWORD_ROOT)
AUTHENTICATION_DB="admin"   # Banco de dados onde a credencial 'chatsael' foi criada (Geralmente 'admin')

COLLECTION="users" # Coleção para inserção.

# Verifica se o shell mongo/mongosh está disponível
if command -v mongosh &> /dev/null; then
    MONGO_CMD="mongosh"
elif command -v mongo &> /dev/null; then
    MONGO_CMD="mongo"
else
    echo "Erro: O comando 'mongosh' ou 'mongo' não foi encontrado."
    echo "Instale o MongoDB Shell (mongosh) na VPS para rodar este script."
    exit 1
fi

# =================================================================
# GERAÇÃO DOS DADOS E COMANDO DE INSERÇÃO
# Inserimos 14 novos (Aluno 2 a Aluno 15), assumindo que o Aluno 1 já existe.
# =================================================================

# Array de comandos de inserção no formato JS/Shell
INSERT_COMMANDS="
use $MONGO_DATABASE;

var users = [];
// Loop para criar Aluno 2 até Aluno 15 (14 usuários)
for (var i = 2; i <= 15; i++) { 
    var email = 'aluno' + i + '@gasparviana.com';
    var name = 'Aluno ' + i;
    
    // Documento base
    var user = {
        '_id': ObjectId(), // Geração de um novo ID único para cada aluno
        'name': name,
        'email': email,
        'password': '\$2a\$10\$Yhkb6kBV/3VsN6V3YMJZoeEDkd1403jat/j/bCOYPP9LA.vZZduTS',
        'role': ['student'],
        'school': { '\$oid': '68f4f57184f48a4ba7a1b4f6' },
        'course': { '\$oid': '68f4f57b84f48a4ba7a1b529' },
        'class': { '\$oid': '68f4f5c184f48a4ba7a1b59a' },
        'disciplines': [{ '\$oid': '68f4f5d784f48a4ba7a1b5d7' }],
        'level': 'desconhecido',
        'status': 'active',
        'previousPasswords': [],
        'createdAt': { '\$date': new Date().toISOString() },
        'updatedAt': { '\$date': new Date().toISOString() },
        '__v': 0
    };
    users.push(user);
}

// Inserção em massa na coleção
var result = db.$COLLECTION.insertMany(users);

if (result && result.acknowledged) {
    print('Total de ' + result.insertedIds.length + ' usuários inseridos na coleção: $COLLECTION');
} else {
    print('Erro na inserção, ou a inserção não foi reconhecida.');
}
"

# =================================================================
# EXECUÇÃO NO MONGODB
# =================================================================

echo "Conectando ao MongoDB e inserindo os usuários..."
echo "Host: $MONGO_HOST | Banco de Dados: $MONGO_DATABASE | Coleção: $COLLECTION"

# Prepara a URI de conexão com autenticação
MONGO_CONNECTION_URI="-u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase $AUTHENTICATION_DB"

# Executa o script de inserção
if $MONGO_CMD "$MONGO_CONNECTION_URI" --host "$MONGO_HOST" --port "$MONGO_PORT" --eval "$INSERT_COMMANDS" ; then
    echo ""
    echo "✅ SCRIPT CONCLUÍDO COM SUCESSO."
else
    echo ""
    echo "❌ ERRO DURANTE A EXECUÇÃO DO SCRIPT NO MONGODB. Verifique as credenciais, o mapeamento de porta do Docker e o status do serviço."
fi