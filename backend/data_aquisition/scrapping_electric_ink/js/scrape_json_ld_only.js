const puppeteer = require('puppeteer');
const fs = require('fs'); // Importa o módulo 'fs' para lidar com arquivos
const path = require('path');

(async () => {
  // Para depuração visual, mude 'headless: true' para 'headless: false'
  const browser = await puppeteer.launch({ headless: false, defaultViewport: null }); // defaultViewport: null para usar o tamanho padrão da janela
  const page = await browser.newPage();

  // Adiciona um listener para capturar logs do console do navegador
  page.on('console', msg => {
    for (let i = 0; i < msg.args().length; ++i) {
      // Tenta converter o argumento para string, se for um JSHandle
      msg.args()[i].jsonValue().then(value => {
        console.log(`[BROWSER CONSOLE] ${value}`);
      }).catch(() => {
        // Se não for um JSHandle ou falhar, imprime como string
        console.log(`[BROWSER CONSOLE] ${msg.args()[i].toString()}`);
      });
    }
  });


  console.log('Abrindo página de produtos da Electric Ink...');
  await page.goto('https://www.electricink.com.br/tatuagem', {
    waitUntil: 'networkidle2', // Espera que não haja mais de 2 requisições de rede por 500ms
    timeout: 60000 // Aumenta o timeout para a navegação inicial
  });

  console.log('Esperando um tempo para o JavaScript carregar o conteúdo inicial...');
  await new Promise(resolve => setTimeout(resolve, 8000)); // Aumentado para 8s para garantir carregamento inicial

  const allProducts = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`Extraindo dados da Página ${currentPage}...`);
    // Garante que o JSON-LD esteja presente
    try {
      await page.waitForSelector('script[type="application/ld+json"]', { timeout: 30000 });
      console.log(`JSON-LD encontrado na página ${currentPage}.`);
    } catch (error) {
      console.warn(`Aviso: JSON-LD não encontrado na página ${currentPage}. Pulando para a próxima página ou finalizando.`);
      hasNextPage = false; // Se não encontrar JSON-LD, pode ser o fim ou um erro.
      break;
    }

    const productsOnPage = await page.evaluate(() => {
      const items = []; // Lista final de produtos a serem retornados
      
      // Helper function to infer material type
      const inferMaterialType = (name, description, brand) => {
        const lowerCaseName = name.toLowerCase();
        const lowerCaseDescription = description ? description.toLowerCase() : '';
        const lowerCaseBrand = brand ? brand.toLowerCase() : '';

        // Priorizar termos mais específicos
        if (lowerCaseName.includes('batoque') || lowerCaseName.includes('ink cap') || lowerCaseName.includes('cap') || lowerCaseDescription.includes('batoque')) {
          return 'Batoques';
        } 
        else if (lowerCaseName.includes('agulha') || lowerCaseName.includes('cartucho') || lowerCaseName.includes('needle') || lowerCaseName.includes('rl') || lowerCaseName.includes('rs') || lowerCaseName.includes('m1') || lowerCaseName.includes('rm') || lowerCaseName.includes('magnum') || lowerCaseName.includes('liner') || lowerCaseName.includes('shader') || lowerCaseDescription.includes('cartucho') || lowerCaseDescription.includes('agulha')) {
          return 'Agulhas e Cartuchos';
        } 
        else if (lowerCaseName.includes('tinta') || lowerCaseName.includes('pigmento') || (lowerCaseName.includes('ink') && !lowerCaseName.includes('ink cap') && !lowerCaseBrand.includes('electric ink')) || lowerCaseName.includes('preto') || lowerCaseName.includes('branco') || lowerCaseDescription.includes('tinta') || lowerCaseDescription.includes('pigmento')) {
          return 'Tintas';
        } 
        else if (lowerCaseName.includes('luva') || lowerCaseName.includes('gloves') || lowerCaseDescription.includes('luva')) {
          return 'Luvas';
        } 
        else if (lowerCaseName.includes('filme') || lowerCaseName.includes('plástico') || lowerCaseName.includes('curativo') || lowerCaseName.includes('bandagem') || lowerCaseName.includes('wrap') || lowerCaseName.includes('cover') || lowerCaseDescription.includes('filme') || lowerCaseDescription.includes('curativo')) {
          return 'Materiais de Barreira';
        } 
        else if (lowerCaseName.includes('álcool') || lowerCaseName.includes('sabonete') || lowerCaseName.includes('desinfetante') || lowerCaseName.includes('cleaner') || lowerCaseName.includes('assepsia') || lowerCaseDescription.includes('higiene') || lowerCaseDescription.includes('assepsia')) {
          return 'Biossegurança e Higiene';
        } 
        else if (lowerCaseName.includes('vaselina') || lowerCaseName.includes('manteiga') || lowerCaseName.includes('butter') || lowerCaseName.includes('aftercare') || lowerCaseName.includes('creme') || lowerCaseDescription.includes('vaselina') || lowerCaseDescription.includes('pós-tattoo')) {
          return 'Cremes e Pós-Tatuagem';
        } 
        else if (lowerCaseName.includes('máquina') || lowerCaseName.includes('machine') || lowerCaseName.includes('pen') || lowerCaseDescription.includes('máquina') || lowerCaseDescription.includes('rotativa')) {
          return 'Máquinas';
        } 
        else if (lowerCaseName.includes('fonte') || lowerCaseName.includes('power supply') || lowerCaseName.includes('cabo') || lowerCaseName.includes('clip cord') || lowerCaseDescription.includes('fonte') || lowerCaseDescription.includes('cabo')) {
          return 'Fontes e Cabos';
        }
        return 'Outros';
      };

      // --- Extração APENAS do JSON-LD ---
      // Buscar todos os scripts JSON-LD na página
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      let productListJson = null;

      // Iterar sobre os scripts para encontrar o que contém a lista de produtos (ItemList de Product)
      jsonLdScripts.forEach(script => {
        try {
          const jsonData = JSON.parse(script.innerText);
          // Verifica se é um ItemList e se o primeiro item é um Produto
          if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement && Array.isArray(jsonData.itemListElement) && jsonData.itemListElement.length > 0 && jsonData.itemListElement[0].item && jsonData.itemListElement[0].item['@type'] === 'Product') {
            productListJson = jsonData;
            console.log("[BROWSER CONSOLE] JSON-LD de produtos (ItemList) encontrado.");
            // Uma vez encontrado, podemos parar de procurar
            return; 
          } else {
            console.log(`[BROWSER CONSOLE] JSON-LD encontrado, mas não é um ItemList de produtos. Tipo: ${jsonData['@type']}`);
          }
        } catch (e) {
          console.error('[BROWSER CONSOLE] Erro ao parsear um JSON-LD:', e.message);
        }
      });

      if (productListJson) {
        productListJson.itemListElement.forEach(item => {
          const product = item.item;
          if (product && product['@type'] === 'Product') {
            const name = product.name || '';
            const brand = product.brand && product.brand.name ? product.brand.name : '';
            const description = product.description || '';
            
            let availablePrices = new Set(); 
            let availableOptions = []; 

            // Extrair todos os preços e SKUs das ofertas individuais
            if (product.offers && product.offers.offers && Array.isArray(product.offers.offers)) {
              product.offers.offers.forEach(offer => {
                if (offer.price !== undefined && offer.price !== null) {
                  const formatted = typeof offer.price === 'number'
                    ? `R$ ${offer.price.toFixed(2).replace('.', ',')}`
                    : `R$ ${offer.price}`;
                  availablePrices.add(formatted);
                }
                if (offer.sku) { // Adiciona o SKU como uma opção disponível
                    availableOptions.push(offer.sku);
                }
              });
            }

            // Fallback para lowPrice/highPrice se não houver ofertas detalhadas ou preços
            if (availablePrices.size === 0 && product.offers) {
                if (product.offers.lowPrice !== undefined && product.offers.lowPrice !== null) {
                    const formattedLow = typeof product.offers.lowPrice === 'number'
                        ? `R$ ${product.offers.lowPrice.toFixed(2).replace('.', ',')}`
                        : `R$ ${product.offers.lowPrice}`;
                    availablePrices.add(formattedLow);
                }
                if (product.offers.highPrice !== undefined && product.offers.highPrice !== null && product.offers.highPrice !== product.offers.lowPrice) {
                    const formattedHigh = typeof product.offers.highPrice === 'number'
                        ? `R$ ${product.offers.highPrice.toFixed(2).replace('.', ',')}`
                        : `R$ ${product.offers.highPrice}`;
                    availablePrices.add(formattedHigh);
                }
            }
            
            const materialType = inferMaterialType(name, description, brand);
            
            items.push({
              name,
              availableOptions: availableOptions.sort(), 
              availablePrice: Array.from(availablePrices).sort((a, b) => { 
                const numA = parseFloat(a.replace('R$ ', '').replace(',', '.'));
                const numB = parseFloat(b.replace('R$ ', '').replace(',', '.'));
                return numA - numB;
              }),
              materialType,
            });
            console.log(`[BROWSER CONSOLE] Produto JSON-LD adicionado: '${name}' (Preços: ${Array.from(availablePrices).join(', ')})`);
          }
        });
      } else {
        console.warn("[BROWSER CONSOLE] Nenhum JSON-LD de produtos (ItemList) válido encontrado na página.");
      }

      return items; 
    });

    allProducts.push(...productsOnPage);
    console.log(`Página ${currentPage}: ${productsOnPage.length} produtos extraídos. Total: ${allProducts.length}`);

    // Tentar encontrar o botão "Próximo"
    const nextButton = await page.$('.electricink-search-result-3-x-nextPage');
    
    // Verificar se o botão existe e não está desabilitado
    if (nextButton) {
      const isDisabled = await page.evaluate(btn => btn.disabled, nextButton);
      if (isDisabled) {
        hasNextPage = false;
        console.log('Botão "Próximo" desabilitado. Fim da paginação.');
      } else {
        console.log('Clicando no botão "Próximo"...');
        await nextButton.click();
        // Espera que a rede fique ociosa novamente após o clique para garantir que novos produtos carreguem
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => console.log('Navegação após clique não detectada ou timeout.'));
        await new Promise(resolve => setTimeout(resolve, 5000)); // Espera adicional para renderização
        currentPage++;
      }
    } else {
      hasNextPage = false; // Botão "Próximo" não encontrado
      console.log('Botão "Próximo" não encontrado. Fim da paginação.');
    }
  }

  // Filtra produtos duplicados de TODO o allProducts no final, para garantir
  const finalAllProducts = [];
  const seen = new Set();
  allProducts.forEach(item => {
    const identifier = `${item.name}-${JSON.stringify(item.availableOptions)}-${JSON.stringify(item.availablePrice)}`;
    if (!seen.has(identifier)) {
      finalAllProducts.push(item);
      seen.add(identifier);
    }
  });

  console.log('Extração de dados concluída. Total de produtos únicos:', finalAllProducts.length);

  // Salvar os dados em um arquivo JSON
  const filePath = './data/listas_brutas/lista_json_ld.json';
  const dirPath = path.dirname(filePath);
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  try {
    fs.writeFileSync(filePath, JSON.stringify(finalAllProducts, null, 2));
    console.log(`Dados salvos com sucesso em ${filePath}`);
  } catch (error) {
    console.error(`Erro ao salvar os dados em ${filePath}:`, error);
  }

  await browser.close();
})();
