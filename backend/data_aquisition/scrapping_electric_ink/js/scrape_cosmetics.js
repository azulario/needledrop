const puppeteer = require('puppeteer');
const fs = require('fs'); // Importa o módulo 'fs' para lidar com arquivos

(async () => {
  // Para depuração visual, mude 'headless: true' para 'headless: false'
  const browser = await puppeteer.launch({ headless: true, defaultViewport: null }); // Defini como headless: true para rodar em segundo plano
  const page = await browser.newPage();

  // Adiciona um listener para capturar logs do console do navegador
  page.on('console', msg => {
    for (let i = 0; i < msg.args().length; ++i) {
      msg.args()[i].jsonValue().then(value => {
        console.log(`[BROWSER CONSOLE] ${value}`);
      }).catch(() => {
        console.log(`[BROWSER CONSOLE] ${msg.args()[i].toString()}`);
      });
    }
  });


  console.log('Abrindo página de produtos de Cosméticos da Electric Ink...');
  await page.goto('https://www.electricink.com.br/cosmeticos', { // URL da página de cosméticos
    waitUntil: 'networkidle2', 
    timeout: 60000 
  });

  console.log('Esperando um tempo para o JavaScript carregar o conteúdo inicial...');
  await new Promise(resolve => setTimeout(resolve, 8000)); 

  const allProducts = [];
  let currentPage = 1;
  let hasNextPage = true;

  while (hasNextPage) {
    console.log(`Extraindo dados de Cosméticos da Página ${currentPage}...`);
    try {
      await page.waitForSelector('.electricink-search-result-3-x-galleryItem, script[type="application/ld+json"]', { timeout: 30000 });
      console.log(`Seletor de item de galeria ou JSON-LD encontrado na página ${currentPage}.`);
    } catch (error) {
      console.warn(`Aviso: Nenhum seletor principal encontrado na página ${currentPage}. Pulando para a próxima página ou finalizando.`);
      hasNextPage = false; 
      break;
    }

    const productsOnPage = await page.evaluate(() => {
      const productsMap = new Map(); // Usar um mapa para produtos do JSON-LD, chave: nome do produto
      const finalProductsList = []; // Lista final de produtos a serem retornados

      // Helper function to infer material type (ADAPTADA PARA COSMÉTICOS)
      const inferMaterialType = (name, description, brand) => {
        const lowerCaseName = name.toLowerCase();
        const lowerCaseDescription = description ? description.toLowerCase() : '';
        const lowerCaseBrand = brand ? brand.toLowerCase() : '';

        // Priorizar termos mais específicos para cosméticos e cuidados
        if (lowerCaseName.includes('vaselina') || lowerCaseName.includes('manteiga') || lowerCaseName.includes('butter') || lowerCaseName.includes('aftercare') || lowerCaseName.includes('creme') || lowerCaseDescription.includes('vaselina') || lowerCaseDescription.includes('pós-tattoo') || lowerCaseDescription.includes('cicatrizante')) {
          return 'Cremes e Pós-Tatuagem';
        } 
        else if (lowerCaseName.includes('sabonete') || lowerCaseName.includes('esfoliante') || lowerCaseName.includes('scrub') || lowerCaseName.includes('limpeza') || lowerCaseDescription.includes('higiene') || lowerCaseDescription.includes('limpeza')) {
          return 'Higiene e Limpeza Corporal';
        }
        else if (lowerCaseName.includes('protetor solar') || lowerCaseName.includes('solar') || lowerCaseDescription.includes('proteção solar')) {
          return 'Proteção Solar';
        }
        else if (lowerCaseName.includes('loção') || lowerCaseName.includes('hidratante') || lowerCaseDescription.includes('hidratante')) {
          return 'Hidratantes e Loções';
        }
        else if (lowerCaseName.includes('stencil') || lowerCaseName.includes('transfer') || lowerCaseDescription.includes('stencil') || lowerCaseDescription.includes('transfer')) {
          return 'Materiais para Stencil'; // Stencil Glue, etc.
        }
        // Manter algumas categorias gerais que podem aparecer em cosméticos (ex: luvas, plásticos)
        else if (lowerCaseName.includes('luva') || lowerCaseName.includes('gloves') || lowerCaseDescription.includes('luva')) {
          return 'Luvas';
        } 
        else if (lowerCaseName.includes('filme') || lowerCaseName.includes('plástico') || lowerCaseName.includes('curativo') || lowerCaseName.includes('bandagem') || lowerCaseName.includes('wrap') || lowerCaseName.includes('cover') || lowerCaseDescription.includes('filme') || lowerCaseDescription.includes('curativo')) {
          return 'Materiais de Barreira';
        } 
        else if (lowerCaseName.includes('álcool') || lowerCaseName.includes('desinfetante') || lowerCaseName.includes('cleaner') || lowerCaseName.includes('assepsia') || lowerCaseDescription.includes('assepsia')) {
          return 'Biossegurança Geral';
        }
        return 'Outros Cosméticos'; // Categoria padrão para o que não se encaixa
      };

      // --- 1. Extração Primária do JSON-LD para o Mapa ---
      const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
      let productListJson = null;

      jsonLdScripts.forEach(script => {
        try {
          const jsonData = JSON.parse(script.innerText);
          if (jsonData['@type'] === 'ItemList' && jsonData.itemListElement && Array.isArray(jsonData.itemListElement) && jsonData.itemListElement.length > 0 && jsonData.itemListElement[0].item && jsonData.itemListElement[0].item['@type'] === 'Product') {
            productListJson = jsonData;
            return; 
          }
        } catch (e) {
          // console.error('[BROWSER CONSOLE] Erro ao parsear um JSON-LD:', e.message); 
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

            if (product.offers && product.offers.offers && Array.isArray(product.offers.offers)) {
              product.offers.offers.forEach(offer => {
                if (offer.price !== undefined && offer.price !== null) {
                  const formatted = typeof offer.price === 'number'
                    ? `R$ ${offer.price.toFixed(2).replace('.', ',')}`
                    : `R$ ${offer.price}`;
                  availablePrices.add(formatted);
                }
              });
            }

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
          }
        });
      } else {
        console.warn("[BROWSER CONSOLE] Nenhum JSON-LD de produtos (ItemList) válido encontrado na página. Apenas HTML será usado como fallback completo.");
      }

      // --- 2. Extração e Enriquecimento do HTML ---
      document.querySelectorAll('.electricink-search-result-3-x-galleryItem').forEach(el => {
        const htmlNameElement = el.querySelector('.electricink-product-summary-2-x-productBrand') || el.querySelector('.electricink-product-summary-2-x-productName');
        const htmlName = htmlNameElement ? htmlNameElement.innerText.trim() : '';

        let targetProduct = productsMap.get(htmlName);

        if (!targetProduct) {
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
            finalProductsList.push(targetProduct); 
        } else {
            if (!finalProductsList.includes(targetProduct)) {
                finalProductsList.push(targetProduct);
            }
        }

        const skuOptionsList = el.querySelector('.electricink-sku-selector-0-x-fakeList'); 
        if (skuOptionsList) {
          skuOptionsList.querySelectorAll('.electricink-sku-selector-0-x-fakeInnerItem').forEach(optionEl => {
            const optionText = optionEl.innerText.trim();
            if (!targetProduct.availableOptions.includes(optionText)) {
                targetProduct.availableOptions.push(optionText);
            }
          });
        } else {
          const skuSelectorSelected = el.querySelector('.electricink-sku-selector-0-x-fakeSelected');
          if (skuSelectorSelected) {
            const optionText = skuSelectorSelected.innerText.trim();
            if (!targetProduct.availableOptions.includes(optionText)) {
                targetProduct.availableOptions.push(optionText);
            }
          } else {
            const volumeMatchName = htmlName.match(/(\d+\s?ml|\d+\s?un\.|caixa\s+com\s+\d+|pote\s+com\s+\d+|^\d+\s*g$)/i); // Adicionado para g
            if (volumeMatchName) {
                const optionText = volumeMatchName[1];
                if (!targetProduct.availableOptions.includes(optionText)) {
                    targetProduct.availableOptions.push(optionText);
                }
            }
          }
        }
      });

      return finalProductsList; 
    });

    allProducts.push(...productsOnPage);
    console.log(`Página ${currentPage}: ${productsOnPage.length} produtos extraídos. Total: ${allProducts.length}`);

    const nextButton = await page.$('.electricink-search-result-3-x-nextPage');
    
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

  const finalAllProducts = [];
  const seen = new Set();
  allProducts.forEach(item => {
    const identifier = `${item.name}-${JSON.stringify(item.availableOptions)}`; 
    if (!seen.has(identifier)) {
      finalAllProducts.push(item);
      seen.add(identifier);
    }
  });

  console.log('Extração de dados concluída. Total de produtos únicos:', finalAllProducts.length);

  const filePath = 'data/listas_brutas/lista_cosmeticos.json'; // Salva para um novo arquivo
  try {
    fs.writeFileSync(filePath, JSON.stringify(finalAllProducts, null, 2));
    console.log(`Dados de Cosméticos salvos com sucesso em ${filePath}`);
  } catch (error) {
    console.error(`Erro ao salvar os dados de Cosméticos em ${filePath}:`, error);
  }

  await browser.close();
})();
