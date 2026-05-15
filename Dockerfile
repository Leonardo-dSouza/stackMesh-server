# Utilizado a versão slim do Node.js para reduzir o tamanho da imagem e por ser mais adequada do que a versão alpine para o ambiente de produção, garantindo melhor compatibilidade e desempenho.
FROM node:22-slim

# Define o diretório de trabalho dentro do contêiner para /app, onde a aplicação será instalada e executada.
WORKDIR /app

# Copia os arquivos de configuração do npm (package.json e package-lock.json) para o diretório de trabalho no contêiner (/app).
# Relembrando que COPY contem 2 argumentos: o primeiro é o caminho do arquivo ou diretório de origem (no host) e o segundo é o caminho de destino dentro do contêiner. 
COPY package*.json ./

# Instala as dependências do projeto utilizando o npm. O comando RUN é utilizado para executar comandos no processo de construção da imagem. Neste caso, ele executa "npm install" para instalar as dependências listadas no package.json, garantindo que a aplicação tenha tudo o que precisa para rodar corretamente.
RUN npm ci

# Após instalar as dependências, o comando COPY é utilizado novamente para copiar todo o restante dos arquivos do projeto (representado por ".") para o diretório de trabalho no contêiner (/app). Isso inclui o código-fonte da aplicação e quaisquer outros arquivos necessários para a execução.
COPY . . 

# O Build nessa camada serve para simplesmente compilar.
RUN npm run build

# O comando EXPOSE é utilizado para informar ao Docker que a aplicação dentro do contêiner irá escutar na porta 5000. Mas é somente para documentação e não realmente expõe a porta. Para expor a porta, é necessário usar a opção -p ou --publish ao executar o contêiner, mapeando a porta do contêiner para uma porta no host.
EXPOSE 5000

# O comando CMD é utilizado para especificar o comando que será executado quando o contêiner for iniciado. Neste caso, ele executa "node dist/main", que inicia a aplicação Node.js a partir do arquivo main.js localizado na pasta dist, onde o código compilado está presente.
CMD [ "node" ,"dist/src/main.js" ]


# Cada Instrução no Dockerfile é executada em uma camada separada, e o Docker utiliza um sistema de cache para otimizar o processo de construção da imagem. Se uma camada não for alterada, o Docker pode reutilizar a camada em cache, acelerando a construção da imagem. No entanto, se um arquivo ou comando for modificado, as camadas subsequentes serão reconstruídas, o que pode levar mais tempo. Portanto, é importante organizar as instruções no Dockerfile de maneira eficiente para aproveitar ao máximo o cache e reduzir o tempo de construção da imagem.
# Por isso é rodado o COPY package*.json antes do COPY . ., para garantir que as dependências sejam instaladas apenas quando os arquivos de configuração do npm forem alterados, evitando a necessidade de reinstalar as dependências toda vez que o código-fonte for modificado.
# Na prática, coloco o que muda menos antes e o que muda mais depois.