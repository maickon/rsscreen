"""Avisa Bing, Yandex e outros buscadores do IndexNow sobre as páginas do site.

Uso (depois de publicar):  python tools/indexnow.py
O IndexNow confere a chave no arquivo <chave>.txt da raiz do site (a chave é pública por natureza).
Manda todas as páginas do guia/paginas.json mais a página inicial.
"""
import glob, json, os, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = 'https://rsscreen.com.br'
HOST = 'rsscreen.com.br'


def chave():
    for f in glob.glob(os.path.join(ROOT, '*.txt')):
        nome = os.path.basename(f)[:-4]
        if len(nome) == 32 and all(c in '0123456789abcdef' for c in nome) and open(f, encoding='utf-8').read().strip() == nome:
            return nome
    raise SystemExit('Arquivo de chave do IndexNow não encontrado na raiz do projeto.')


def main():
    k = chave()
    paginas = json.load(open(os.path.join(ROOT, 'guia', 'paginas.json'), encoding='utf-8'))
    urls = [SITE + '/'] + [SITE + p['url'] for p in paginas]
    corpo = json.dumps({'host': HOST, 'key': k, 'keyLocation': '%s/%s.txt' % (SITE, k), 'urlList': urls}).encode('utf-8')
    req = urllib.request.Request('https://api.indexnow.org/indexnow', data=corpo, method='POST',
                                 headers={'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print('IndexNow:', r.status, '(%d endereços enviados)' % len(urls))
    except urllib.error.HTTPError as e:
        print('IndexNow respondeu', e.code, e.read()[:300])


if __name__ == '__main__':
    main()
