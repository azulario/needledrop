import subprocess
import os
import shutil # Para remover pastas e arquivos temporários

def run_command(command, cwd=None):
    """
    Executa um comando de shell e imprime sua saída.
    Levanta um erro se o comando falhar.
    """
    try:
        # Usamos text=True para capturar a saída como string e check=True para levantar um erro em caso de falha.
        # cwd (current working directory) define o diretório de execução do comando.
        result = subprocess.run(command, shell=True, check=True, capture_output=True, text=True, cwd=cwd)
        print(f"Comando executado com sucesso: {command}")
        print("--- SAÍDA DO COMANDO ---")
        print(result.stdout)
        if result.stderr:
            print("--- ERROS DO COMANDO (STDERR) ---")
            print(result.stderr)
        print("-----------------------")
    except subprocess.CalledProcessError as e:
        print(f"ERRO: Comando falhou: {command}")
        print("--- SAÍDA DO ERRO (STDOUT) ---")
        print(e.stdout)
        print("--- ERROS DO COMANDO (STDERR) ---")
        print(e.stderr)
        raise e # Re-lança o erro para parar a pipeline

def setup_directories():
    """Cria a estrutura de diretórios necessária."""
    print("Configurando diretórios...")
    base_data_dir = "data"
    raw_lists_dir = os.path.join(base_data_dir, "listas_brutas")
    merged_lists_dir = os.path.join(base_data_dir, "listas_mescladas")
    categorized_lists_dir = os.path.join(merged_lists_dir, "categorized_by_type_and_brand")

    # Remover diretórios existentes para garantir um início limpo
    if os.path.exists(raw_lists_dir):
        shutil.rmtree(raw_lists_dir)
    if os.path.exists(merged_lists_dir):
        shutil.rmtree(merged_lists_dir)

    os.makedirs(raw_lists_dir, exist_ok=True)
    os.makedirs(merged_lists_dir, exist_ok=True)
    os.makedirs(categorized_lists_dir, exist_ok=True) # categorized_by_type_and_brand é criado aqui
    print("Diretórios configurados.")


def run_full_pipeline():
    """
    Orquestra a execução de todos os scripts de scraping, mesclagem e categorização.
    """
    print("Iniciando a pipeline completa de scraping e processamento...")

    try:
        # Configurar diretórios
        setup_directories()

        # --- 1. Executar o scraping JSON-LD (JavaScript) ---
        print("\n--- Executando scraping JSON-LD ---")
        # O comando é executado a partir da raiz do projeto, então o caminho para o script é 'js/scrape_json_ld_only.js'
        run_command("node js/scrape_json_ld_only.js")
        print("Scraping JSON-LD concluído.")

        # --- 2. Executar o scraping HTML (JavaScript) ---
        print("\n--- Executando scraping HTML ---")
        run_command("node js/scrape_html_only.js")
        print("Scraping HTML concluído.")

        # --- 3. Executar a mesclagem das listas (Python) ---
        print("\n--- Executando mesclagem das listas ---")
        # O comando é executado a partir da raiz do projeto, então o caminho para o script é 'python/merge_lists.py'
        run_command("python3 python/merge_lists.py")
        print("Mesclagem de listas concluída.")

        # --- 4. Executar a categorização das listas (Python) ---
        print("\n--- Executando categorização das listas ---")
        run_command("python3 python/categorize_products.py")
        print("Categorização de listas concluída.")

        print("\nPipeline completa executada com sucesso!")
        print("Seus arquivos categorizados estão em: data/listas_mescladas/categorized_by_type_and_brand/")

    except Exception as e:
        print(f"\nPipeline falhou devido a um erro: {e}")

if __name__ == "__main__":
    run_full_pipeline()

