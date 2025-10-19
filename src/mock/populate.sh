#!/bin/bash

# =================================================================
# CONFIGURAÇÕES DO MONGODB (AJUSTE SOMENTE SE MUDAR A CONFIG)
# =================================================================
MONGO_DATABASE="logibot_db"
MONGO_CONTAINER_NAME="logibot_mongodb" 
MONGO_USER="chatsael"
MONGO_PASSWORD="chatsael_password"
AUTHENTICATION_DB="admin"
COLLECTION="users" # COLEÇÃO CORRETA

# Tenta usar 'mongosh' ou 'mongo'
DOCKER_EXEC_CMD="mongosh"
if ! docker exec $MONGO_CONTAINER_NAME bash -c "command -v mongosh" &> /dev/null; then
    DOCKER_EXEC_CMD="mongo"
fi
DOCKER_ARGS="-u $MONGO_USER -p $MONGO_PASSWORD --authenticationDatabase $AUTHENTICATION_DB"

echo "Injetando comandos no container Docker: $MONGO_CONTAINER_NAME na coleção: $COLLECTION..."

# === Bloco de Inserção JavaScript (Sintaxe Limpa) ===
MONGO_JSON="
use $MONGO_DATABASE;
var users = [];
for (var i = 2; i <= 15; i++) {
    var name = 'Aluno ' + i;
    var email = 'aluno' + i + '@gasparviana.com';
    
    users.push({
        '_id': ObjectId(), 
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
    });
}
var result = db.$COLLECTION.insertMany(users);

if (result && result.acknowledged) {
    print('Total de ' + result.insertedIds.length + ' usuários inseridos com sucesso.');
    
    // Imprime o ID do último aluno para verificação
    print('ID do Aluno 15 (último inserido): ' + result.insertedIds[result.insertedIds.length - 1].toHexString());
} else {
    print('Erro na inserção, ou a inserção não foi reconhecida.');
}
"

# =================================================================
# EXECUÇÃO E VERIFICAÇÃO NO CONTAINER DOCKER
# =================================================================

# Executa o comando de inserção
if docker exec $MONGO_CONTAINER_NAME $DOCKER_EXEC_CMD $DOCKER_ARGS --eval "$MONGO_JSON"; then
    echo ""
    echo "✅ ETAPA 1: INSERÇÃO DE USUÁRIOS CONCLUÍDA COM SUCESSO."
    echo "--------------------------------------------------------"
    echo "VERIFICANDO SE OS NOMES FORAM INSERIDOS CORRETAMENTE..."
    
    # Nova verificação de busca por nome (agora deve funcionar)
    docker exec $MONGO_CONTAINER_NAME $DOCKER_EXEC_CMD $DOCKER_ARGS --eval "db.$COLLECTION.findOne({ name: 'Aluno 15' }, { _id: 1, name: 1, email: 1 });"

    echo ""
    echo "Se o resultado acima mostrar o Aluno 15, o script funcionou."
else
    echo ""
    echo "❌ ERRO DURANTE A EXECUÇÃO DO SCRIPT NO MONGODB."
fi
