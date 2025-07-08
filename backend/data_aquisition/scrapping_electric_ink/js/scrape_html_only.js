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
    // Garante que os itens da galeria estejam presentes antes de extrair
    try {
      await page.waitForSelector('.electricink-search-result-3-x-galleryItem', { timeout: 30000 });
      console.log(`Seletor de item de galeria encontrado na página ${currentPage}.`);
    } catch (error) {
      console.warn(`Aviso: Nenhum seletor de item de galeria encontrado na página ${currentPage}. Pulando para a próxima página ou finalizando.`);
      hasNextPage = false; // Se não encontrar itens, pode ser o fim ou um erro.
      break;
    }

    const productsOnPage = await page.evaluate(() => {
      const items = []; // Lista final de produtos a serem retornados

      // Helper function to infer material type based on name and brand from HTML
      const inferMaterialType = (name, brand) => {
        const lowerCaseName = name.toLowerCase();
        const lowerCaseBrand = brand ? brand.toLowerCase() : '';

        // Priorizar termos mais específicos
        if (lowerCaseName.includes('batoque') || lowerCaseName.includes('ink cap') || lowerCaseName.includes('cap')) {
          return 'Batoques';
        } 
        else if (lowerCaseName.includes('agulha') || lowerCaseName.includes('cartucho') || lowerCaseName.includes('needle') || lowerCaseName.includes('rl') || lowerCaseName.includes('rs') || lowerCaseName.includes('m1') || lowerCaseName.includes('rm') || lowerCaseName.includes('magnum') || lowerCaseName.includes('liner') || lowerCaseName.includes('shader')) {
          return 'Agulhas e Cartuchos';
        } 
        else if (lowerCaseName.includes('tinta') || lowerCaseName.includes('pigmento') || (lowerCaseName.includes('ink') && !lowerCaseName.includes('ink cap') && !lowerCaseBrand.includes('electric ink')) || lowerCaseName.includes('preto') || lowerCaseName.includes('branco')) {
          return 'Tintas';
        } 
        else if (lowerCaseName.includes('luva') || lowerCaseName.includes('gloves')) {
          return 'Luvas';
        } 
        else if (lowerCaseName.includes('filme') || lowerCaseName.includes('plástico') || lowerCaseName.includes('curativo') || lowerCaseName.includes('bandagem') || lowerCaseName.includes('wrap') || lowerCaseName.includes('cover')) {
          return 'Materiais de Barreira';
        } 
        else if (lowerCaseName.includes('álcool') || lowerCaseName.includes('sabonete') || lowerCaseName.includes('desinfetante') || lowerCaseName.includes('cleaner') || lowerCaseName.includes('assepsia')) {
          return 'Biossegurança e Higiene';
        } 
        else if (lowerCaseName.includes('vaselina') || lowerCaseName.includes('manteiga') || lowerCaseName.includes('butter') || lowerCaseName.includes('aftercare') || lowerCaseName.includes('creme')) {
          return 'Cremes e Pós-Tatuagem';
        } 
        else if (lowerCaseName.includes('máquina') || lowerCaseName.includes('machine') || lowerCaseName.includes('pen')) {
          return 'Máquinas';
        } 
        else if (lowerCaseName.includes('fonte') || lowerCaseName.includes('power supply') || lowerCaseName.includes('cabo') || lowerCaseName.includes('clip cord')) {
          return 'Fontes e Cabos';
        }
        return 'Outros';
      };

      // --- Extração APENAS do HTML ---
      document.querySelectorAll('.electricink-search-result-3-x-galleryItem').forEach(el => {
        const nameElement = el.querySelector('.electricink-product-summary-2-x-productBrand') || el.querySelector('.electricink-product-summary-2-x-productName');
        const name = nameElement ? nameElement.innerText.trim() : '';

        // Extração da Marca (tentando pegar a marca separada do nome, se houver)
        const brandElement = el.querySelector('.electricink-product-summary-2-x-productBrand');
        const brand = (brandElement && brandElement.innerText.trim() !== name) ? brandElement.innerText.trim() : '';

        // Extração do Preço Principal (disponível na listagem)
        const mainPriceElement = el.querySelector('.electricink-product-price-1-x-sellingPriceValue');
        const mainPrice = mainPriceElement ? mainPriceElement.innerText.trim() : '';
        
        let availablePrices = [];
        if (mainPrice) {
            availablePrices.push(mainPrice);
        }
        // Nota: Sem o JSON-LD, é muito difícil obter *todos* os preços de variações (SKUs)
        // apenas da listagem HTML. Este campo conterá principalmente o preço principal.

        // Extração das Opções de Tamanho/Quantidade (availableOptions)
        let availableOptions = [];
        const skuOptionsList = el.querySelector('.electricink-sku-selector-0-x-fakeList'); // O UL que contém as opções
        
        if (skuOptionsList) {
          skuOptionsList.querySelectorAll('.electricink-sku-selector-0-x-fakeInnerItem').forEach(optionEl => {
            const optionText = optionEl.innerText.trim();
            if (!availableOptions.includes(optionText)) {
                availableOptions.push(optionText);
            }
          });
          console.log(`[BROWSER CONSOLE] HTML: Opções para '${name}': ${availableOptions.join(', ')}`);
        } else {
          // Fallback para a opção selecionada ou do nome se a lista não for encontrada no HTML
          const skuSelectorSelected = el.querySelector('.electricink-sku-selector-0-x-fakeSelected');
          if (skuSelectorSelected) {
            const optionText = skuSelectorSelected.innerText.trim();
            if (!availableOptions.includes(optionText)) {
                availableOptions.push(optionText);
            }
            console.log(`[BROWSER CONSOLE] HTML: Opção selecionada para '${name}': ${optionText}`);
          } else {
            // Último fallback: tentar pegar volume/quantidade do nome do produto
            const volumeMatchName = name.match(/(\d+\s?ml|\d+\s?un\.|caixa\s+com\s+\d+|pote\s+com\s+\d+)/i);
            if (volumeMatchName) {
                const optionText = volumeMatchName[1];
                if (!availableOptions.includes(optionText)) {
                    availableOptions.push(optionText);
                }
                console.log(`[BROWSER CONSOLE] HTML: Opção do nome para '${name}': ${optionText}`);
            }
          }
        }
        
        const materialType = inferMaterialType(name, '', brand); // Descrição não está disponível no HTML de listagem

        items.push({
          name,
          availableOptions: availableOptions.sort(), // Ordena as opções
          availablePrice: availablePrices.sort((a, b) => { // Ordena os preços
            const numA = parseFloat(a.replace('R$ ', '').replace(',', '.'));
            const numB = parseFloat(b.replace('R$ ', '').replace(',', '.'));
            return numA - numB;
          }),
          materialType,
        });
        console.log(`[BROWSER CONSOLE] HTML: Produto '${name}' extraído. Preços: ${availablePrices.join(', ')}`);
      });

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
    // Identificador de deduplicação: nome e opções disponíveis
    const identifier = `${item.name}-${JSON.stringify(item.availableOptions)}`; 
    if (!seen.has(identifier)) {
      finalAllProducts.push(item);
      seen.add(identifier);
    }
  });

  console.log('Extração de dados concluída. Total de produtos únicos:', finalAllProducts.length);

  // Salvar os dados em um arquivo JSON
  const filePath = './data/listas_brutas/lista_html.json';
  const dirPath = path.dirname(filePath);

  // Criar diretório se não existir
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
