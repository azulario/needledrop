import json
import os

def merge_product_lists(json_ld_input, html_input, cosmeticos_input, output_file):
    """
    Mescla três listas de produtos (JSON-LD, HTML e Cosméticos) priorizando
    dados específicos de cada fonte.

    Args:
        json_ld_input (str): Caminho para o arquivo JSON gerado pelo scraping JSON-LD.
        html_input (str): Caminho para o arquivo JSON gerado pelo scraping HTML.
        cosmeticos_input (str): Caminho para o arquivo JSON de cosméticos.
        output_file (str): Caminho para o arquivo JSON de saída mesclado.
    """
    print("Iniciando mesclagem das listas...")

    # 1. Verificar se os arquivos existem
    if not os.path.exists(json_ld_input):
        print(f"Erro: Arquivo '{json_ld_input}' não encontrado. Por favor, execute 'scrape_json_ld_only.js' primeiro.")
        return
    if not os.path.exists(html_input):
        print(f"Erro: Arquivo '{html_input}' não encontrado. Por favor, execute 'scrape_html_only.js' primeiro.")
        return
    
    cosmeticos_exists = os.path.exists(cosmeticos_input)
    if not cosmeticos_exists:
        print(f"Aviso: Arquivo de cosméticos '{cosmeticos_input}' não encontrado. Continuando sem dados de cosméticos.")

    try:
        # 2. Ler as listas de entrada
        with open(json_ld_input, 'r', encoding='utf-8') as f:
            json_ld_products = json.load(f)
        
        with open(html_input, 'r', encoding='utf-8') as f:
            html_products = json.load(f)
            
        # Carregar cosméticos se disponíveis
        cosmeticos_products = []
        if cosmeticos_exists:
            try:
                with open(cosmeticos_input, 'r', encoding='utf-8') as f:
                    cosmeticos_products = json.load(f)
                print(f"Dados de cosméticos carregados: {len(cosmeticos_products)} produtos")
            except Exception as e:
                print(f"Erro ao carregar dados de cosméticos: {e}")
                cosmeticos_products = []

        # Usaremos um dicionário para armazenar os produtos mesclados, usando o nome como chave
        products_map = {}

        # 3. Popular o mapa com os produtos da lista JSON-LD (prioridade para preços e tipo)
        for prod in json_ld_products:
            product_name = prod['name'].strip()
            # Identificar marca com base no nome do produto
            brand = ''
            material_type = prod.get('materialType', 'Outros')
            
            # Regra 1: Se contém "EG", a marca é "Easy Glow"
            if " EG" in product_name or product_name.endswith(" EG"):
                brand = "Easy Glow"
                material_type = "Tintas"  # Sobrescreve qualquer valor anterior
            
            # Regra 2: Se contém "INTZ", a marca é "Intenze" e o tipo é "Tintas"
            elif "INTZ" in product_name:
                brand = "Intenze"
                material_type = "Tintas"  # Sobrescreve qualquer valor anterior
            
            # Regra 3: Se não tem marca específica, usa Electric Ink como padrão
            else:
                brand = "Electric Ink"
                
            products_map[product_name] = { 
                'name': product_name,
                'brand': brand,
                'availableOptions': [],  # Inicializa vazio, será preenchido pelo HTML
                'availablePrice': prod.get('availablePrice', []), 
                'materialType': material_type
            }
        
        print(f"Produtos carregados do JSON-LD: {len(products_map)}")

        # 4. Iterar sobre os produtos da lista HTML para complementar as opções
        for html_prod in html_products:
            product_name = html_prod['name'].strip()
            
            if product_name in products_map:
                # Produto encontrado no JSON-LD
                products_map[product_name]['availableOptions'] = html_prod.get('availableOptions', [])
                print(f"Mesclado: '{product_name}' (JSON-LD com opções HTML)")
            else:
                # Produto NÃO encontrado no JSON-LD: Adicionar o produto do HTML como fallback
                material_type = html_prod.get('materialType', 'Outros')
                
                # Aplicar as mesmas regras de marca/tipo
                brand = ''
                
                # Regra 1: Se contém "EG", a marca é "Easy Glow"
                if " EG" in product_name or product_name.endswith(" EG"):
                    brand = "Easy Glow"
                    material_type = "Tintas"
                
                # Regra 2: Se contém "INTZ", a marca é "Intenze" e o tipo é "Tintas"
                elif "INTZ" in product_name:
                    brand = "Intenze"
                    material_type = "Tintas"
                
                # Regra 3: Se não tem marca específica, usa Electric Ink como padrão
                else:
                    brand = "Electric Ink"
                
                products_map[product_name] = {
                    'name': product_name,
                    'brand': brand,
                    'availableOptions': html_prod.get('availableOptions', []),
                    'availablePrice': html_prod.get('availablePrice', []),
                    'materialType': material_type
                }
                print(f"Adicionado como Fallback: '{product_name}' (Somente HTML)")
                
               # Substitua o bloco de processamento de cosméticos pelo seguinte:
        
        # 5. Adicionar produtos de cosméticos (se existirem)
        if cosmeticos_products:
            for cosm_prod in cosmeticos_products:
                product_name = cosm_prod['name'].strip()
                
                # Obter o materialType do produto de cosméticos (já categorizado corretamente)
                cosm_material_type = cosm_prod.get('materialType', 'Outros Cosméticos')
                
                # Se o produto já existe, mesclar informações
                if product_name in products_map:
                    existing = products_map[product_name]
                    
                    # Se não tem opções, usar as do cosmético
                    if not existing['availableOptions'] and cosm_prod.get('availableOptions'):
                        existing['availableOptions'] = cosm_prod.get('availableOptions')
                    
                    # Se não tem preços, usar os do cosmético
                    if not existing['availablePrice'] and cosm_prod.get('availablePrice'):
                        existing['availablePrice'] = cosm_prod.get('availablePrice')
                    
                    # Usar o materialType específico do arquivo de cosméticos
                    existing['materialType'] = cosm_material_type
                        
                    print(f"Mesclado: '{product_name}' (existente com dados de cosméticos)")
                else:
                    # Produto não existe, adicionar como novo com seu materialType original
                    products_map[product_name] = {
                        'name': product_name,
                        'brand': cosm_prod.get('brand', 'Electric Ink'),
                        'availableOptions': cosm_prod.get('availableOptions', []),
                        'availablePrice': cosm_prod.get('availablePrice', []),
                        'materialType': cosm_material_type
                    }
                    print(f"Adicionado: '{product_name}' (produto de cosméticos)")

        # 6. Converter o dicionário de volta para um Array
        merged_products = list(products_map.values())

        # 7. Ordenar a lista final por nome para consistência
        merged_products.sort(key=lambda x: x['name'])

        # 8. Criar diretório de saída se não existir
        os.makedirs(os.path.dirname(output_file), exist_ok=True)

        # 9. Salvar a lista mesclada em um novo arquivo JSON
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(merged_products, f, indent=2, ensure_ascii=False)
        
        print(f"Listas mescladas com sucesso em '{output_file}'. Total de produtos únicos: {len(merged_products)}")

    except FileNotFoundError as e:
        print(f"Erro: Um dos arquivos não foi encontrado. Detalhes: {e}")
    except json.JSONDecodeError as e:
        print(f"Erro: Problema ao decodificar um arquivo JSON. Verifique a formatação. Detalhes: {e}")
    except Exception as e:
        print(f"Ocorreu um erro inesperado durante a mesclagem: {e}")

# Nomes dos arquivos de entrada e saída
json_ld_input = './data/listas_brutas/lista_json_ld.json'
html_input = './data/listas_brutas/lista_html.json'
cosmeticos_input = './data/listas_brutas/lista_cosmeticos.json'
output_final = './data/listas_mescladas/lista_final_mesclada.json'

# Garantir que os diretórios existam
os.makedirs(os.path.dirname(json_ld_input), exist_ok=True)
os.makedirs(os.path.dirname(output_final), exist_ok=True)

# Chamar a função de mesclagem
merge_product_lists(json_ld_input, html_input, cosmeticos_input, output_final)

