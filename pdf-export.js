/* Vozes da Oncologia - exportação local em PDF, versão V9.
 * Sem bibliotecas externas, ligações a servidores, recolha ou armazenamento remoto.
 * Cada página A4 é composta independentemente; texto livre nunca é truncado.
 * O conteúdo é desenhado no PDF à resolução de impressão, incluindo Unicode.
 */
(function () {
  'use strict';
  const A4 = { width: 595.28, height: 841.89 };
  const SCALE = 2.5; // 180 dpi: 595 pt -> 1488 píxeis
  const M = 42, RIGHT = A4.width - M, CONTENT = RIGHT - M;
  const INK = '#16181c', MUTED = '#545c65', DIM = '#77808a';
  const YELLOW = '#ffdc16', GRAY = '#f6f6f4', STROKE = '#e7e8e8';
  const PAGE_BOTTOM = A4.height - 69;
  const fonts = {
    body: 'Inter, Arial, sans-serif',
    title: 'Manrope, Inter, Arial, sans-serif'
  };
  const safe = s => String(s ?? '');
  const nonempty = (s, replacement='Não indicado') => safe(s).trim() || replacement;
  function localFilename(now=new Date()) {
    const two = x => String(x).padStart(2, '0');
    return `Vozes da Oncologia_${two(now.getHours())}${two(now.getMinutes())}${two(now.getSeconds())}_${two(now.getDate())}${two(now.getMonth()+1)}${now.getFullYear()}.pdf`;
  }
  function textStyle(size=10, weight=400, family='body', color=INK) {
    return {size, weight, family, color};
  }
  class Composer {
    constructor(data, image) {
      this.data=data; this.illustration=image;
      this.pages=[]; this.page=null; this.y=0;
      this.measureCanvas=document.createElement('canvas');
      this.measure=this.measureCanvas.getContext('2d');
      this.addPage();
    }
    addPage() {
      this.page=[]; this.pages.push(this.page);
      this.y=M;
    }
    command(kind, values) { this.page.push({kind, ...values}); }
    font(st) {return `${st.weight} ${st.size}px ${fonts[st.family] || fonts.body}`;}
    width(text,st) {this.measure.font=this.font(st);return this.measure.measureText(text).width;}
    // Iterate by grapheme: no field is lost, even with a very long uninterrupted token.
    graphemes(text) {return typeof Intl!=='undefined' && Intl.Segmenter
      ? Array.from(new Intl.Segmenter('pt-PT',{granularity:'grapheme'}).segment(text),s=>s.segment)
      : Array.from(text);}
    wrap(text, max, st) {
      const result=[];
      const paragraphs=safe(text).replace(/\r\n?/g,'\n').split('\n');
      for(const paragraph of paragraphs) {
        if(paragraph==='') { result.push(''); continue; }
        const words=paragraph.match(/\S+|\s+/gu)||[];
        let line='';
        for(const word of words) {
          if(/^\s+$/u.test(word) && !line)continue;
          if(this.width(line+word,st) <= max) {line+=word;continue;}
          if(line.trim()) {result.push(line.trimEnd());line='';}
          if(/^\s+$/u.test(word))continue;
          if(this.width(word,st)<=max) {line=word;continue;}
          // Break a very long URL or unspaced sequence without discarding characters.
          for(const glyph of this.graphemes(word)) {
            if(line && this.width(line+glyph,st)>max) {result.push(line);line='';}
            line+=glyph;
          }
        }
        result.push(line.trimEnd());
      }
      return result;
    }
    need(height=20) {if(this.y + height>PAGE_BOTTOM) this.addPage();}
    text(text, x, y, st, options={}) {this.command('text',{text:safe(text),x,y,st,align:options.align||'left'});}
    rect(x,y,w,h,color, radius=0, border=null) {this.command('rect',{x,y,w,h,color,radius,border});}
    rule(y,x=M,w=CONTENT,color=STROKE,thickness=1) {this.command('rule',{x,y,w,color,thickness});}
    paragraph(value, cfg={}) {
      const st=cfg.style||textStyle(10,400,'body','#343b42');
      const lineHeight=cfg.lineHeight || st.size*1.56;
      const indent=cfg.indent||0;
      const x=cfg.x ?? (M+indent);
      const w=cfg.width || (CONTENT-indent);
      const lines=this.wrap(value,w,st);
      for(const line of lines) {
        this.need(lineHeight+2);
        if(cfg.leftBar) this.rect(M+3,this.y-2,3,lineHeight+4,YELLOW,0);
        if(line) this.text(line,x,this.y+st.size*0.98,st);
        this.y+=lineHeight;
      }
      this.y+=cfg.after??6;
    }
    headline(label,title,sub='') {
      this.need(65);
      this.y+=10;
      this.rule(this.y);this.y+=14;
      this.paragraph(label.toUpperCase(),{style:textStyle(8,700,'body',DIM),lineHeight:11,after:3});
      this.paragraph(title,{style:textStyle(17,800,'title',INK),lineHeight:23,after:sub?2:10});
      if(sub) this.paragraph(sub,{style:textStyle(9,400,'body',MUTED),lineHeight:13,after:9});
    }
    answer(label,answer) {
      this.need(44);
      this.y+=4;
      this.paragraph(label,{style:textStyle(11.5,700,'title',INK),lineHeight:17,after:6});
      // Dynamic height; no fixed-size text boxes. Multi-paragraph, newline and page breaks supported.
      this.paragraph(nonempty(answer),{style:textStyle(10,400,'body','#303841'),lineHeight:16.2,leftBar:true,indent:14,after:13});
    }
    info(label,value) {
      this.need(40);
      this.paragraph(label.toUpperCase(),{style:textStyle(8,700,'body',DIM),lineHeight:11,after:2});
      this.paragraph(nonempty(value),{style:textStyle(10,600,'body',INK),lineHeight:15,after:10});
    }
    pair(label,value) {
      this.need(48);
      this.paragraph(label,{style:textStyle(9.5,650,'body',INK),lineHeight:14,after:3});
      this.paragraph(nonempty(value,'Sem resposta'),{style:textStyle(9.7,400,'body',MUTED),lineHeight:15,indent:13,after:8});
      this.rule(this.y);this.y+=7;
    }
    cover() {
      this.text('VOZES DA ONCOLOGIA',M,53,textStyle(10,800,'title',INK));
      this.text('CÓPIA PESSOAL',RIGHT,53,textStyle(8,700,'body',DIM),{align:'right'});
      this.rect(M,64,55,3,YELLOW);
      this.y=80;
      // A ilustração fornecida aparece apenas na primeira página.
      if(this.illustration) {
        const h=CONTENT * this.illustration.height/this.illustration.width;
        this.command('image',{x:M,y:this.y,w:CONTENT,h,img:this.illustration});
        this.y += h+15;
      }
      this.paragraph(this.data.receipt?'A minha participação':'A minha cópia pessoal',{style:textStyle(26,800,'title',INK),lineHeight:33,after:3});
      this.rect(M,this.y,61,4,YELLOW);this.y+=12;
      this.paragraph(this.data.receipt?'Uma cópia das respostas que partilhou.':'Uma cópia das respostas que preparou.',{style:textStyle(12,400,'body',MUTED),lineHeight:18,after:9});
      this.paragraph(this.data.receipt?'Obrigado por partilhar a sua experiência. Cada contributo ajuda a identificar prioridades para melhorar os cuidados oncológicos em Portugal.':'Este documento reúne as respostas preparadas localmente. Não constitui comprovativo de envio ou de receção.',{style:textStyle(9.6,400,'body','#414850'),lineHeight:14.5,after:13});
      const cols=[
        ['PERSPETIVA PRINCIPAL',nonempty(this.data.primaryRole)],
        ['FAIXA ETÁRIA',nonempty(this.data.ageGroup)],
        ['REGIÃO',nonempty(this.data.region)]
      ];
      const colWidth=(CONTENT-30)/3;
      const columnText=cols.map(([key,val])=>({key,lines:this.wrap(val,colWidth-17,textStyle(8.7,700,'body',INK))}));
      const boxHeight=Math.max(74,47+11*Math.max(...columnText.map(c=>c.lines.length)));
      this.need(boxHeight+12);
      this.rect(M,this.y,CONTENT,boxHeight,GRAY,9,STROKE);
      const yy=this.y;
      this.text('INFORMAÇÕES DA PARTICIPAÇÃO',M+15,yy+19,textStyle(8.2,700,'body',MUTED));
      columnText.forEach(({key,lines},i)=>{
        const xx=M+15+i*colWidth;
        if(i) this.rect(xx-7,yy+32,1,boxHeight-44,'#d5d8db');
        this.text(key,xx,yy+42,textStyle(6.6,700,'body',DIM));
        lines.forEach((line,j)=>this.text(line,xx,yy+55+j*11,textStyle(8.7,700,'body',INK)));
      });
      this.y+=boxHeight+13;
      this.need(45);
      this.rect(M,this.y,CONTENT,36,'#fff9e8',7,'#f1e2aa');
      this.text(this.data.receipt?'RECEÇÃO CONFIRMADA PELO SERVIDOR':'CÓPIA LOCAL · NÃO ENVIADA',M+11,this.y+13,textStyle(8.2,700,'body','#625a39'));
      this.text(this.data.receipt?'Identificador: '+this.data.receipt:'Não comprova envio ou receção; nenhuma resposta é enviada ao servidor.',M+11,this.y+26,textStyle(8.1,400,'body','#625a39'));
      this.y+=41;
    }
    build() {
      this.cover();
      this.headline('ESCUTA ABERTA','A sua experiência, na íntegra','Todas as respostas abaixo são reproduzidas integralmente, incluindo em páginas seguintes.');
      this.answer('1. Que dificuldade ou problema gostaria de dar a conhecer?',this.data.difficulty);
      if(safe(this.data.solution).trim()) this.answer('2. Como considera que esta situação poderia ser melhorada?',this.data.solution);
      if(safe(this.data.extra).trim()) this.answer('3. Há mais alguma coisa que queira acrescentar?',this.data.extra);
      // Os três dados do perfil já aparecem no quadro da primeira página.
      // Suprimir repetições e secções de perguntas opcionais sem respostas.
      this.headline('PERFIL E CONTEXTO','Informações complementares');
      this.info('Perfis selecionados',this.data.roles.join(' · '));
      if(safe(this.data.context).trim()) this.answer('Contexto adicional do seu perfil',this.data.context);
      const answeredQuestions=Array.isArray(this.data.questions)
        ? this.data.questions.filter(q=>safe(q.answer).trim())
        : [];
      if(answeredQuestions.length) {
        this.headline('INDICADORES OPCIONAIS','Perguntas complementares');
        for(const q of answeredQuestions) this.pair(q.text,q.answer);
      }
      if(this.data.contact && safe(this.data.email).trim()) {
        this.headline('CONTACTO E PRIVACIDADE','Preferências indicadas');
        this.info('Email facultativo',this.data.email);
        this.info('Preferência de recontacto','Sim');
      }
            this.need(68);
      this.rect(M,this.y,CONTENT,53,GRAY,8,STROKE);
      this.text('SOBRE ESTA CÓPIA',M+12,this.y+17,textStyle(8,700,'body',MUTED));
      this.text(this.data.receipt?'Receção confirmada. Este PDF é gerado no seu dispositivo.':'É uma cópia pessoal gerada neste dispositivo. Não houve envio ao projeto.',M+12,this.y+32,textStyle(8.3,400,'body',INK));
      this.text('Conserve-a ou elimine-a conforme desejar.',M+12,this.y+44,textStyle(8.3,400,'body',INK));
      this.y+=57;
      return this.pages;
    }
    render(page, number, count) {
      const canvas=document.createElement('canvas');
      canvas.width=Math.round(A4.width*SCALE);
      canvas.height=Math.round(A4.height*SCALE);
      const ctx=canvas.getContext('2d', {alpha:false});
      if(!ctx) throw new Error('O browser não disponibilizou uma área de desenho para criar o PDF.');
      ctx.setTransform(SCALE,0,0,SCALE,0,0);
      ctx.fillStyle='#fff';ctx.fillRect(0,0,A4.width,A4.height);
      const rounded = (x,y,w,h,r)=>{
        const R=Math.min(r,w/2,h/2);
        ctx.beginPath();ctx.moveTo(x+R,y);ctx.lineTo(x+w-R,y);ctx.quadraticCurveTo(x+w,y,x+w,y+R);
        ctx.lineTo(x+w,y+h-R);ctx.quadraticCurveTo(x+w,y+h,x+w-R,y+h);
        ctx.lineTo(x+R,y+h);ctx.quadraticCurveTo(x,y+h,x,y+h-R);
        ctx.lineTo(x,y+R);ctx.quadraticCurveTo(x,y,x+R,y);ctx.closePath();
      };
      const drawText=(text,x,y,st,align='left')=>{
        ctx.font=this.font(st); ctx.fillStyle=st.color;ctx.textBaseline='alphabetic';ctx.textAlign=align;
        ctx.fillText(text,x,y);ctx.textAlign='left';
      };
      for(const cmd of page) {
        if(cmd.kind==='text') drawText(cmd.text,cmd.x,cmd.y,cmd.st,cmd.align);
        else if(cmd.kind==='rect') {
          rounded(cmd.x,cmd.y,cmd.w,cmd.h,cmd.radius||0);ctx.fillStyle=cmd.color;ctx.fill();
          if(cmd.border){ctx.strokeStyle=cmd.border;ctx.lineWidth=.8;ctx.stroke();}
        }
        else if(cmd.kind==='rule') {ctx.beginPath();ctx.moveTo(cmd.x,cmd.y);ctx.lineTo(cmd.x+cmd.w,cmd.y);ctx.strokeStyle=cmd.color;ctx.lineWidth=cmd.thickness;ctx.stroke();}
        else if(cmd.kind==='image') ctx.drawImage(cmd.img,cmd.x,cmd.y,cmd.w,cmd.h);
      }
      ctx.fillStyle=YELLOW;ctx.fillRect(M,A4.height-47,CONTENT,2.2);
      drawText('www.vozesoncologia.pt',M,A4.height-28,textStyle(8,700,'body',INK));
      drawText(this.data.receipt?'Cópia pessoal · Receção confirmada':'Cópia pessoal · Sem envio',A4.width/2,A4.height-28,textStyle(7.7,400,'body',DIM),'center');
      drawText(`Página ${number} de ${count}`,RIGHT,A4.height-28,textStyle(8,600,'body',INK),'right');
      return canvas.toDataURL('image/jpeg',0.88);
    }
  }
  function dataUrlToBytes(dataUrl) {
    const data=atob(dataUrl.split(',')[1]);
    const bytes=new Uint8Array(data.length);
    for(let i=0;i<data.length;i++)bytes[i]=data.charCodeAt(i);
    return bytes;
  }
  // PDF A4: aparência visual em JPEG + camada de texto pesquisável.
  // A camada de texto utiliza o mesmo comando de texto, por página, da renderização.
  // Helvetica com WinAnsi cobre os caracteres latinos portugueses; outros são aproximados.
  const winAnsiSpecial = {
    0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,
    0x2020:0x86,0x2021:0x87,0x02C6:0x88,0x2030:0x89,0x0160:0x8A,
    0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,
    0x201C:0x93,0x201D:0x94,0x2022:0x95,0x2013:0x96,0x2014:0x97,
    0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,
    0x017E:0x9E,0x0178:0x9F
  };
  function pdfHexText(value) {
    let out='';
    for(const char of safe(value)) {
      const cp=char.codePointAt(0);
      const byte=(cp>=32&&cp<=126)||(cp>=160&&cp<=255)?cp:(winAnsiSpecial[cp]??63);
      out+=byte.toString(16).padStart(2,'0');
    }
    return '<'+out+'>';
  }
  function pdfUtf16Text(value) {
    let out='FEFF';
    for(let i=0;i<value.length;i++){
      const code=value.charCodeAt(i);
      out+=code.toString(16).padStart(4,'0');
    }
    return '<'+out+'>';
  }
  function pdfTextLayer(commands) {
    if(!Array.isArray(commands))return '';
    const n=v=>String(Math.round(v*100)/100);
    return commands.filter(command=>command.kind==='text'&&command.text).map(command=>{
      // Coordenadas em canvas: origem no canto superior esquerdo. No PDF, no inferior.
      const size=command.st?.size||10;
      const x=command.x;
      const y=A4.height-command.y;
      const h=pdfHexText(command.text);
      // ActualText preserva Unicode integral, mesmo quando a fonte de seleção
      // não consegue representar certos caracteres. 3 Tr mantém o aspeto intacto.
      const exact=pdfUtf16Text(command.text);
      return `/Span << /ActualText ${exact} >> BDC\nBT /F1 ${n(size)} Tf 3 Tr 1 0 0 1 ${n(x)} ${n(y)} Tm ${h} Tj ET\nEMC\n`;
    }).join('');
  }
  function pdfFromImages(imageUrls,width,height,textPages=[]) {
    const textEncoder=new TextEncoder();
    const chunks=[];const offsets=[0];let length=0;
    const write=bytes=>{const data=typeof bytes==='string'?textEncoder.encode(bytes):bytes;chunks.push(data);length+=data.length;};
    const obj=(id,body)=>{offsets[id]=length;write(`${id} 0 obj\n${body}\nendobj\n`);};
    const stream=(id,header,bytes)=>{
      offsets[id]=length;write(`${id} 0 obj\n${header}\nstream\n`);
      write(bytes);write('\nendstream\nendobj\n');
    };
    write(new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10]));
    const count=imageUrls.length;
    obj(1,'<< /Type /Catalog /Pages 2 0 R >>');
    obj(2,`<< /Type /Pages /Kids [${imageUrls.map((_,i)=>`${4+i*3} 0 R`).join(' ')}] /Count ${count} >>`);
    obj(3,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    for(let i=0;i<count;i++){
      const p=4+i*3,im=p+1,content=p+2;
      const jpeg=dataUrlToBytes(imageUrls[i]);
      obj(p,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4.width} ${A4.height}] /Resources << /XObject << /Im0 ${im} 0 R >> /Font << /F1 3 0 R >> >> /Contents ${content} 0 R >>`);
      stream(im,`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>`,jpeg);
      const drawing=`q ${A4.width} 0 0 ${A4.height} 0 0 cm /Im0 Do Q\n`;
      const textLayer=pdfTextLayer(textPages[i]);
      const commandBytes=textEncoder.encode(drawing+textLayer);
      stream(content,`<< /Length ${commandBytes.length} >>`,commandBytes);
    }
    const size=4+count*3;
    const xrefOffset=length;
    write(`xref\n0 ${size}\n0000000000 65535 f \n`);
    for(let i=1;i<size;i++)write(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
    write(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);
    return new Blob(chunks,{type:'application/pdf'});
  }
  function loadIllustration(src) {
    return new Promise(resolve => {
      const image=new Image();
      image.onload=()=>resolve(image);
      image.onerror=()=>resolve(null); // fallback: complete PDF without image
      image.src=src;
    });
  }
  async function create(data, options={}) {
    await document.fonts?.ready;
    // A ilustração é facultativa. Não tentar carregar um recurso inexistente.
    const image=options.illustration ? await loadIllustration(options.illustration) : null;
    const composer=new Composer(data,image);
    const pages=composer.build();
    const images=[];
    for(let i=0;i<pages.length;i++){
      images.push(composer.render(pages[i],i+1,pages.length));
      // Yield to the browser during long exports without changing document contents.
      if(i%4===3)await new Promise(resolve=>setTimeout(resolve,0));
    }
    return {blob:pdfFromImages(images,Math.round(A4.width*SCALE),Math.round(A4.height*SCALE),pages),filename:localFilename(),pages:pages.length};
  }
  async function download(data,options={}) {
    const result=await create(data,options);
    const url=URL.createObjectURL(result.blob);
    const a=document.createElement('a');
    a.href=url;a.download=result.filename;a.style.display='none';
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),30000);
    return result;
  }
  window.VozesPDF=Object.freeze({create,download,localFilename});
})();
