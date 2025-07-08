const puppeteer = require('puppeteer');
const fs = require('fs'); // Importa o módulo 'fs' para lidar com arquivos

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
    // Garante que os itens da galeria ou o JSON-LD estejam presentes
    try {
      await page.waitForSelector('.electricink-search-result-3-x-galleryItem, script[type="application/ld+json"]', { timeout: 30000 });
      console.log(`Seletor de item de galeria ou JSON-LD encontrado na página ${currentPage}.`);
    } catch (error) {
      console.warn(`Aviso: Nenhum seletor principal encontrado na página ${currentPage}. Pulando para a próxima página ou finalizando.`);
      hasNextPage = false; // Se não encontrar itens, pode ser o fim ou um erro.
      break;
    }

    const productsOnPage = await page.evaluate(() => {
      const productsMap = new Map(); // Usar um mapa para produtos do JSON-LD, chave: nome do produto
      const finalProductsList = []; // Lista final de produtos a serem retornados

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

      // --- 1. Extração Primária do JSON-LD para o Mapa ---
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      let productListJson = null;

      jsonLdScripts.forEach(script => {
        try {
          const jsonData = JSON.parse(script.innerText);
          if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement && Array.isArray(jsonData.itemListElement) && jsonData.itemListElement.length > 0 && jsonData.itemListElement[0].item && jsonData.itemListElement[0].item['@type'] === 'Product') {
            productListJson = jsonData;
            console.log("[BROWSER CONSOLE] JSON-LD de produtos (ItemList) encontrado.");
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

            // PRIORIDADE 1: Extrair todos os preços individuais dos offers (que é o que você quer)
            if (product.offers && product.offers.offers && Array.isArray(product.offers.offers)) {
              console.log(`[BROWSER CONSOLE] DEBUG: Processando offers.offers para '${name}'. Tamanho do array offers: ${product.offers.offers.length}`);
              product.offers.offers.forEach(offer => {
                if (offer.price !== undefined && offer.price !== null) {
                  const formatted = typeof offer.price === 'number'
                    ? `R$ ${offer.price.toFixed(2).replace('.', ',')}`
                    : `R$ ${offer.price}`;
                  availablePrices.add(formatted);
                  console.log(`[BROWSER CONSOLE] DEBUG: Adicionado preço de oferta individual para '${name}': ${formatted}`);
                }
              });
            }

            // PRIORIDADE 2: Se não houver ofertas individuais (ou se elas não tiverem preço), tentar o lowPrice/highPrice do AggregateOffer
            if (availablePrices.size === 0 && product.offers) {
                if (product.offers.lowPrice !== undefined && product.offers.lowPrice !== null) {
                    const formattedLow = typeof product.offers.lowPrice === 'number'
                        ? `R$ ${product.offers.lowPrice.toFixed(2).replace('.', ',')}`
                        : `R$ ${product.offers.lowPrice}`;
                    availablePrices.add(formattedLow);
                    console.log(`[BROWSER CONSOLE] DEBUG: lowPrice para '${name}': ${formattedLow}`);
                }
                if (product.offers.highPrice !== undefined && product.offers.highPrice !== null && product.offers.highPrice !== product.offers.lowPrice) {
                    const formattedHigh = typeof product.offers.highPrice === 'number'
                        ? `R$ ${product.offers.highPrice.toFixed(2).replace('.', ',')}`
                        : `R$ ${product.offers.highPrice}`;
                    availablePrices.add(formattedHigh);
                    console.log(`[BROWSER CONSOLE] DEBUG: highPrice para '${name}': ${formattedHigh}`);
                }
            }
            
            const materialType = inferMaterialType(name, description, brand);
            
            // Armazena no mapa, usando o nome como chave. availableOptions vazio inicialmente.
            productsMap.set(name, {
              name,
              availableOptions: [], 
              availablePrice: Array.from(availablePrices).sort((a, b) => { 
                const numA = parseFloat(a.replace('R$ ', '').replace(',', '.'));
                const numB = parseFloat(b.replace('R$ ', '').replace(',', '.'));
                return numA - numB;
              }),
              materialType,
            });
            console.log(`[BROWSER CONSOLE] JSON-LD: Produto '${name}' extraído para o mapa. Preços Finais no Set: ${availablePrices.size}. Array Final: ${Array.from(availablePrices).join(', ')}`);
          }
        });
      } else {
        console.warn("[BROWSER CONSOLE] Nenhum JSON-LD de produtos (ItemList) válido encontrado na página. Apenas HTML será usado como fallback completo.");
      }

      // --- 2. Extração e Enriquecimento do HTML ---
      // Itera sobre os elementos visíveis para pegar availableOptions e, se necessário, dados de fallback
      document.querySelectorAll('.electricink-search-result-3-x-galleryItem').forEach(el => {
        const htmlNameElement = el.querySelector('.electricink-product-summary-2-x-productBrand') || el.querySelector('.electricink-product-summary-2-x-productName');
        const htmlName = htmlNameElement ? htmlNameElement.innerText.trim() : '';

        // Tenta encontrar o produto no mapa que foi populado pelo JSON-LD
        let targetProduct = productsMap.get(htmlName);

        console.log(`[BROWSER CONSOLE] Processando produto HTML: '${htmlName}', Encontrado no JSON-LD Map: ${targetProduct ? 'Sim' : 'Não'}`);

        // Se o produto NÃO foi encontrado no JSON-LD, cria um novo item APENAS com dados do HTML.
        if (!targetProduct) {
            console.warn(`[BROWSER CONSOLE] HTML Fallback: Produto '${htmlName}' não encontrado no JSON-LD. Criando item APENAS do HTML.`);
            const htmlPriceElement = el.querySelector('.electricink-product-price-1-x-sellingPriceValue');
            const htmlPrice = htmlPriceElement ? htmlPriceElement.innerText.trim() : '';
            
            const htmlBrandElement = el.querySelector('.electricink-product-summary-2-x-productBrand');
            const htmlBrand = htmlBrandElement ? htmlBrandElement.innerText.trim() : '';

            targetProduct = { 
                name: htmlName,
                availableOptions: [],
                availablePrice: htmlPrice ? [htmlPrice] : [], 
                materialType: inferMaterialType(htmlName, '', htmlBrand),
            };
            // Adiciona o novo produto à lista final
            finalProductsList.push(targetProduct); 
        } else {
            // Se o produto foi encontrado no JSON-LD, adiciona-o à lista final (se já não estiver lá)
            if (!finalProductsList.includes(targetProduct)) {
                finalProductsList.push(targetProduct);
            }
        }

        // Extrair TODAS as opções de volume/quantidade do SKU Selector do HTML
        // e adicionar ao `targetProduct` (seja ele vindo do JSON-LD ou do HTML)
        const skuOptionsList = el.querySelector('.electricink-sku-selector-0-x-fakeList');
        if (skuOptionsList) {
          skuOptionsList.querySelectorAll('.electricink-sku-selector-0-x-fakeInnerItem').forEach(optionEl => {
            const optionText = optionEl.innerText.trim();
            if (!targetProduct.availableOptions.includes(optionText)) {
                targetProduct.availableOptions.push(optionText);
            }
          });
          console.log(`[BROWSER CONSOLE] HTML: Opções para '${htmlName}': ${targetProduct.availableOptions.join(', ')}`);
        } else {
          // Fallback para a opção selecionada ou do nome se a lista não for encontrada no HTML
          const skuSelectorSelected = el.querySelector('.electricink-sku-selector-0-x-fakeSelected');
          if (skuSelectorSelected) {
            const optionText = skuSelectorSelected.innerText.trim();
            if (!targetProduct.availableOptions.includes(optionText)) {
                targetProduct.availableOptions.push(optionText);
            }
            console.log(`[BROWSER CONSOLE] HTML: Opção selecionada para '${htmlName}': ${optionText}`);
          } else {
            const volumeMatchName = htmlName.match(/(\d+\s?ml|\d+\s?un\.|caixa\s+com\s+\d+|pote\s+com\s+\d+)/i);
            if (volumeMatchName) {
                const optionText = volumeMatchName[1];
                if (!targetProduct.availableOptions.includes(optionText)) {
                    targetProduct.availableOptions.push(optionText);
                }
                console.log(`[BROWSER CONSOLE] HTML: Opção do nome para '${htmlName}': ${optionText}`);
            }
          }
        }
      });

      return finalProductsList; 
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
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 }).catch(() => console.log('Navegação após clique não detectada ou timeout.'));
        await new Promise(resolve => setTimeout(resolve, 5000)); 
        currentPage++;
      }
    } else {
      hasNextPage = false; 
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
  const filePath = 'electric_ink_products.json';
  try {
    fs.writeFileSync(filePath, JSON.stringify(finalAllProducts, null, 2));
    console.log(`Dados salvos com sucesso em ${filePath}`);
  } catch (error) {
    console.error(`Erro ao salvar os dados em ${filePath}:`, error);
  }

  await browser.close();
})();
