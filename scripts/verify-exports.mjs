import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';
const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.resolve(repo, 'artifacts/verification');
fs.mkdirSync(outDir, {recursive: true});
const mod = p => import(pathToFileURL(path.join(repo,p)));
const {BookProjectService} = await mod('src/services/books/BookProjectService.js');
const {BookProjectRepository} = await mod('src/services/books/BookProjectRepository.js');
const {PoemRepository} = await mod('src/services/PoemRepository.js');
const {CollectionRepository} = await mod('src/services/CollectionRepository.js');
const {BookExportService} = await mod('src/services/books/export/BookExportService.js');
const {BookLayoutEngine} = await mod('src/services/books/BookLayoutEngine.js');
const {BookPdfGenerator} = await mod('src/services/books/export/BookPdfGenerator.js');
class MemoryStorageAdapter {
 constructor(){this.store=new Map()}
 get(k){return this.store.has(k)?JSON.parse(this.store.get(k)):null}
 set(k,v){this.store.set(k,JSON.stringify(v));return true}
 remove(k){this.store.delete(k);return true}
 clear(){this.store.clear()}
}
const adapter=new MemoryStorageAdapter();
const poemRepo=new PoemRepository(adapter);
const bookRepo=new BookProjectRepository(adapter);
const collectionRepo=new CollectionRepository(adapter);
const bookService=new BookProjectService({bookRepo,poemRepo,collectionRepo});
const exportService=new BookExportService({bookService});
const cases=['क्ष','त्र','ज्ञ','श्र','द्व','द्घ','हृ','क़','ख़','ग़','ज़','ड़','ढ़','फ़','चाँद','ॐ','दुःख','।','॥'];
const body=[
 'क्ष त्र ज्ञ श्र द्व द्घ हृ',
 'क़ ख़ ग़ ज़ ड़ ढ़ फ़',
 'चाँद ॐ दुःख । ॥',
 '',
 'कविता की किरणें खिलीं।',
 'आ इ ई उ ऊ ए ऐ ओ औ ऋ',
 'क् किं कुं कूँ कः कँ',
 'Hindi / English: कविता, moon, 2026.',
 'चाँद के नीचे हृदय में स्वर।',
 '',
 'श्रद्धा और ज्ञान का संगम।',
 'द्वार पर दुःख भी क्षण भर ठहरा।',
 'Emoji: 🌙 ✨'
].join('\n');
const longBody=Array.from({length:20},(_,i)=>[
 `छंद ${i+1}: चाँद से बात हुई।`,
 `छंद ${i+1}: क्षितिज पर दीप जले।`,
 `छंद ${i+1}: हृदय में स्वर जागे।`,
 `छंद ${i+1}: दुःख के बाद सवेरा॥`
].join('\n')).join('\n\n');
const p1=poemRepo.create({title:'अक्षर और चाँद',author:'परीक्षण कवि',body});
const p2=poemRepo.create({title:'लंबी यात्रा',author:'परीक्षण कवि',body:longBody});
const book=bookService.createBook({title:'काव्य परीक्षण',subtitle:'हिन्दी अक्षर और छंद',author:'परीक्षण कवि',dedication:'कविता, चाँद और शब्दों के प्रेमियों को।',description:'Phase 7.4 synthetic verification fixture; no user library data.',cover:{background:'bhojpatra'},sections:[{title:'अक्षर साधना',description:'संयुक्ताक्षर और मात्राएँ',poemIds:[p1.id],order:0},{title:'दीर्घ कविता',description:'पृष्ठों में चलती कविता',poemIds:[p2.id],order:1}]});
let networkCalls=0;
globalThis.fetch=()=>{networkCalls++;throw new Error('Network forbidden during fixture export')};
const before=JSON.stringify([...adapter.store]);
const outputs=[];
for(const pageSize of ['a5','a4','letter']) for(const orientation of ['portrait','landscape']) {
 const config={pageSize,orientation};
 const result=exportService.exportToPdf(book.id,config);
 const file=`verification-${pageSize}-${orientation}.pdf`;
 fs.writeFileSync(path.join(outDir,file),result.data);
 const layout=BookLayoutEngine.generateLayout(bookService.generateBookDocument(book.id),config);
 fs.writeFileSync(path.join(outDir,`layout-${pageSize}-${orientation}.json`),JSON.stringify(layout,null,2));
 outputs.push({file,bytes:result.size,pages:result.pageCount,warnings:result.warnings});
}
const epub=exportService.exportToEpub(book.id);
fs.writeFileSync(path.join(outDir,'verification.epub'),epub.data);
outputs.push({file:'verification.epub',bytes:epub.size,poems:epub.poemCount,sections:epub.sectionCount,warnings:epub.warnings});
for (const background of ['bhojpatra', 'syahi', 'khaddar', 'makhmali-raat']) {
 const document = bookService.generateBookDocument(book.id);
 document.metadata.cover = {...document.metadata.cover, background};
 const layout = BookLayoutEngine.generateLayout(document);
 layout.pages = layout.pages.slice(0, 1);
 const result = BookPdfGenerator.generatePdf(layout);
 fs.writeFileSync(path.join(outDir,`cover-${background}.pdf`), result.data);
}
const unchanged=before===JSON.stringify([...adapter.store]);
const {BackupService} = await mod('src/services/storage/BackupService.js');
const backup = new BackupService({getItem: key => adapter.store.get(key) ?? null});
fs.writeFileSync(path.join(outDir,'synthetic-library.json'),await backup.exportBackup());
fs.writeFileSync(path.join(outDir,'fixture.json'),JSON.stringify({book,poems:[p1,p2],cases},null,2));
const summary={outputs,sourceStorageUnchanged:unchanged,networkCalls};
fs.writeFileSync(path.join(outDir,'generation.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify(summary,null,2));
if(!unchanged||networkCalls)process.exitCode=1;
