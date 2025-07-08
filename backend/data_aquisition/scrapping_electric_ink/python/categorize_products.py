import json
import os
import re # Para expressões regulares

def transform_and_structure_data(input_file, output_dir="data/listas_mescladas/structured_by_type"):
    """
    Lê a lista de produtos mesclada e a transforma em um modelo JSON mais detalhado,
    separando por tipo de material e adicionando campos específicos.

    Args:
        input_file (str): Caminho para o arquivo JSON de entrada (lista_final_mesclada.json).
        output_dir (str): Diretório onde os arquivos JSON estruturados serão salvos.
    """
    print(f"Iniciando transformação e estruturação de dados de '{input_file}'...")

    if not os.path.exists(input_file):
        print(f"Erro: Arquivo de entrada '{input_file}' não encontrado.")
        return

    if not os.path.exists(output_dir):
        os.makedirs(output_dir)
        print(f"Diretório de saída '{output_dir}' criado.")

    try:
        with open(input_file, 'r', encoding='utf-8') as f:
            products = json.load(f)

        structured_data = {
            "agulhas_e_cartuchos": [],
            "tintas": [],
            "maquinas": [],
            "fontes_e_cabos": [],
            "batoques": [],
            "luvas": [],
            "materiais_de_barreira": [],
            "cremes_e_pos_tatuagem": [],
            "pedais": [],
            "bicos_e_tips": [],
            "biosseguranca_e_higiene": [],
            "materiais_para_stencil": [],  # Nova categoria
            "higiene_e_limpeza_corporal": [],  # Nova categoria
            "outros_cosmeticos": [],  # Nova categoria
            "outros": []
        }

        for product in products:
            name = product.get('name', '')
            brand = product.get('brand', '') 
            material_type = product.get('materialType', 'Outros')
            available_options = product.get('availableOptions', [])
            available_price = product.get('availablePrice', [])

            # Converte a lista de preços para float para facilitar a manipulação
            prices_float = sorted([float(p.replace('R$', '').replace('.', '').replace(',', '.').strip()) for p in available_price if p])

            # Preço mais baixo e mais alto da lista
            lowest_price = f"R$ {prices_float[0]:.2f}".replace('.', ',') if prices_float else None
            highest_price = f"R$ {prices_float[-1]:.2f}".replace('.', ',') if prices_float else None
            
            # Formata todos os preços disponíveis
            all_formatted_prices = [f"R$ {p:.2f}".replace('.', ',') for p in prices_float]

            # --- Lógica de Estruturação por Tipo de Material ---
            structured_product = {
                "name": name,
                "brand": brand,
                "available_options_raw": available_options,
                "all_available_prices": all_formatted_prices,
                "lowest_price": lowest_price,
                "highest_price": highest_price,
                "material_type": material_type
            }

            # --- CATEGORIZAÇÃO PARA COSMÉTICOS ---
            # Verificar se é material para stencil
            is_stencil = (
                "stencil" in name.lower() or 
                "transfer" in name.lower() or 
                "thermal" in name.lower() or
                "spirit paper" in name.lower() or
                "slip" in name.lower()  # Vaselina para deslizar estêncil
            )
            
            # Verificar se é produto de higiene e limpeza corporal
            is_higiene = (
                "after all" in name.lower() or
                "clean up" in name.lower() or
                "cleaning water" in name.lower() or
                "the gloo" in name.lower() or
                "scrub out" in name.lower()
            )
            
            # Verificar se é creme pós-tatuagem
            is_cream = (
                "manteiga" in name.lower() or
                "butter" in name.lower() or
                "cat slobber" in name.lower() or
                "cream derma" in name.lower()
            )

            # --- RECLASSIFICAÇÃO DE PRODUTOS COSMÉTICOS ---
            # Se vier de uma fonte de cosméticos ou tiver palavras-chave específicas, recategorizar
            if "Cosméticos" in material_type:
                if is_stencil:
                    material_type = "Materiais para Stencil"
                elif is_higiene:
                    material_type = "Higiene e Limpeza Corporal"
                elif is_cream:
                    material_type = "Cremes e Pós-Tatuagem"
                else:
                    material_type = "Outros Cosméticos"
                
                # Atualizar o tipo no produto estruturado
                structured_product["material_type"] = material_type
            
            # Processar de acordo com o tipo de material
            if material_type == "Agulhas e Cartuchos":
                # Código existente para Agulhas e Cartuchos...
                structured_data["agulhas_e_cartuchos"].append(structured_product)

            elif material_type == "Tintas":
                # Código existente para Tintas...
                structured_data["tintas"].append(structured_product)

            # --- NOVAS CATEGORIAS DE COSMÉTICOS ---
            elif material_type == "Materiais para Stencil":
                tipo = None
                if "transfer" in name.lower():
                    tipo = "Transfer"
                elif "vaseline" in name.lower() or "slip" in name.lower():
                    tipo = "Vaselina"
                elif "thermal" in name.lower() or "spirit paper" in name.lower():
                    tipo = "Papel Térmico"
                
                volume_match = re.search(r'(\d+\s?ml|\d+\s?g)', name.lower())
                volume = volume_match.group(0) if volume_match else None
                
                opcoes_volume = []
                for opt in available_options:
                    # Extrair volume/peso das opções
                    vol_match = re.search(r'(\d+\s?ml|\d+\s?g)', opt.lower())
                    if vol_match:
                        opcoes_volume.append({
                            "medida_string": opt,
                            "medida_valor": vol_match.group(0)
                        })
                    # Extrair quantidade de unidades
                    qty_match = re.search(r'(\d+)\s*(Un\.|un\.|unidades)', opt.lower())
                    if qty_match:
                        opcoes_volume.append({
                            "medida_string": opt,
                            "quantidade": int(qty_match.group(1))
                        })
                
                structured_product.update({
                    "tipo": tipo,
                    "volume": volume,
                    "opcoes": opcoes_volume
                })
                structured_data["materiais_para_stencil"].append(structured_product)

            elif material_type == "Higiene e Limpeza Corporal":
                tipo = None
                if "after all" in name.lower():
                    tipo = "Hidratante Pós-Tatuagem"
                elif "clean up" in name.lower():
                    tipo = "Solução de Limpeza"
                elif "cleaning water" in name.lower():
                    tipo = "Água de Limpeza"
                elif "the gloo" in name.lower():
                    tipo = "Cola para Estêncil"
                elif "scrub out" in name.lower():
                    tipo = "Esfoliante"
                
                volume_match = re.search(r'(\d+\s?ml|\d+\s?L)', name.lower())
                volume = volume_match.group(0) if volume_match else None
                
                opcoes_volume = []
                for opt in available_options:
                    # Extrair volume das opções
                    vol_match = re.search(r'(\d+\s?ml|\d+\s?L)', opt.lower())
                    if vol_match:
                        opcoes_volume.append({
                            "volume_string": opt,
                            "volume_valor": vol_match.group(0)
                        })
                
                structured_product.update({
                    "tipo": tipo,
                    "volume": volume,
                    "opcoes_volume": opcoes_volume
                })
                structured_data["higiene_e_limpeza_corporal"].append(structured_product)

            elif material_type == "Cremes e Pós-Tatuagem":
                # Reutilizar código existente e adicionar mais campos específicos
                tipo = "Vaselina" if "vaselina" in name.lower() else \
                       "Manteiga" if "manteiga" in name.lower() or "butter" in name.lower() or "cat slobber" in name.lower() else \
                       "Aftercare" if "aftercare" in name.lower() else \
                       "Creme" if "creme" in name.lower() or "cream" in name.lower() else None
                
                volume_match = re.search(r'(\d+\s?g|\d+\s?ml)', name.lower())
                volume = volume_match.group(0) if volume_match else None
                
                kit = "kit" in name.lower()
                monodose = "monodose" in name.lower()
                
                structured_product.update({
                    "tipo": tipo,
                    "volume": volume,
                    "kit": kit,
                    "monodose": monodose
                })
                structured_data["cremes_e_pos_tatuagem"].append(structured_product)

            elif material_type == "Outros Cosméticos":
                # Capturar equipamentos especiais como impressoras
                equipamento = "impressora" in name.lower() or "bateria" in name.lower() or "estojo" in name.lower()
                
                tipo = None
                if "impressora" in name.lower():
                    tipo = "Impressora"
                elif "bateria" in name.lower():
                    tipo = "Bateria"
                elif "estojo" in name.lower():
                    tipo = "Estojo"
                elif "kit" in name.lower():
                    tipo = "Kit"
                elif "tattoo to go" in name.lower():
                    tipo = "Protetor Portátil"
                elif "protection" in name.lower():
                    tipo = "Protetor"
                
                kit = "kit" in name.lower()
                
                structured_product.update({
                    "tipo": tipo,
                    "equipamento": equipamento,
                    "kit": kit
                })
                structured_data["outros_cosmeticos"].append(structured_product)
                
            # Continuar com o código existente para outras categorias...
            elif material_type == "Batoques":
                # Código existente...
                structured_data["batoques"].append(structured_product)
                
            # ... (código existente para outras categorias) ...
            
            else:
                structured_product.update({"tipo": None}) 
                structured_data["outros"].append(structured_product)

        # Salvar cada lista categorizada em um arquivo JSON separado
        for category, items_list in structured_data.items():
            if items_list: # Salva apenas se a lista não estiver vazia
                # Criar diretório para a categoria
                category_dir = os.path.join(output_dir, category)
                os.makedirs(category_dir, exist_ok=True)

                # Agrupar por marca dentro da categoria
                products_by_brand = {}
                for item in items_list:
                    brand = item.get('brand', 'Sem Marca')
                    if brand not in products_by_brand:
                        products_by_brand[brand] = []
                    products_by_brand[brand].append(item)
                
                for brand_name, brand_products in products_by_brand.items():
                    # Normalizar o nome do arquivo (remover espaços, caracteres especiais)
                    safe_brand_name = brand_name.replace(' ', '_').replace('/', '_').replace('-', '_').replace('(', '').replace(')', '').lower()
                    output_filepath = os.path.join(category_dir, f"{safe_brand_name}.json")
                    
                    # Ordenar produtos por nome dentro da marca
                    brand_products.sort(key=lambda x: x['name'])

                    with open(output_filepath, 'w', encoding='utf-8') as f:
                        json.dump(brand_products, f, indent=2, ensure_ascii=False)
                    print(f"Lista de '{category}' - '{brand_name}' salva em '{output_filepath}'. Total de itens: {len(brand_products)}")

        # Adicionalmente, criar um arquivo cosmeticos.json com estrutura específica
        cosmeticos_json = {
            "produtos": {
                "materiais_para_stencil": structured_data["materiais_para_stencil"],
                "outros_cosmeticos": structured_data["outros_cosmeticos"],
                "higiene_e_limpeza_corporal": structured_data["higiene_e_limpeza_corporal"],
                "cremes_e_pos_tatuagem": structured_data["cremes_e_pos_tatuagem"]
            }
        }
        
        # Salvar o arquivo cosmeticos.json
        cosmeticos_output = os.path.join(output_dir, "cosmeticos.json")
        with open(cosmeticos_output, 'w', encoding='utf-8') as f:
            json.dump(cosmeticos_json, f, indent=2, ensure_ascii=False)
        print(f"Arquivo consolidado de cosméticos salvo em '{cosmeticos_output}'")

        print("Transformação e estruturação de dados concluída com sucesso!")

    except json.JSONDecodeError as e:
        print(f"Erro: Problema ao decodificar o arquivo JSON '{input_file}'. Verifique a formatação. Detalhes: {e}")
    except Exception as e:
        print(f"Ocorreu um erro inesperado durante a transformação: {e}")

# Caminho para o arquivo de entrada (resultado da mesclagem)
input_merged_file = './data/listas_mescladas/lista_final_mesclada.json'

# Garantir que o diretório existe
os.makedirs(os.path.dirname(input_merged_file), exist_ok=True)

# Chamar a função de transformação
transform_and_structure_data(input_merged_file)