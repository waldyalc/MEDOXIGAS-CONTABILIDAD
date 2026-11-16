import re,sys,os,shutil
src,name=sys.argv[1],sys.argv[2]
# rutas relativas a este script: docs/alegra/css-inicio/<name>/
base=os.path.join(os.path.dirname(os.path.abspath(__file__)),name)
os.makedirs(base+'/original',exist_ok=True)
h=open(src,encoding='utf-8').read()
h=re.sub(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}','correo@ejemplo.com',h)
h=re.sub(r'<script\b[^>]*>.*?</script>','',h,flags=re.S|re.I)
open(base+'/original/'+name+'-singlefile.html','w',encoding='utf-8').write(h)
h=re.sub(r'<meta[^>]*http-equiv=["\']?content-security-policy[^>]*>','',h,flags=re.I)
i=h.lower().find('</head>')
head,body=h[:i],h[i:]
styles=re.findall(r'<style\b[^>]*>(.*?)</style>',head,flags=re.S|re.I)
head=re.sub(r'<style\b[^>]*>.*?</style>','',head,flags=re.S|re.I)
open(base+'/styles.css','w',encoding='utf-8').write('\n'.join(styles))
open(base+'/index.html','w',encoding='utf-8').write(head+'<link rel="stylesheet" href="styles.css">'+body)
print(name,len(styles),'head styles', os.path.getsize(base+'/styles.css'))
