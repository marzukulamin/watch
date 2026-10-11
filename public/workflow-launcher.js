const link = document.createElement('a');
link.className = 'workflow-launcher';
link.href = '/workflow.html';
link.textContent = 'Test a user workflow →';
link.setAttribute('aria-label', 'Open guided demo: test customer or admin workflow');
Object.assign(link.style, { position:'fixed', bottom:'20px', left:'20px', zIndex:'70', padding:'12px 18px', borderRadius:'8px', background:'#263c29', color:'#fff', font:'600 14px/1.5 system-ui', textDecoration:'none', boxShadow:'0 4px 20px #0003', maxWidth:'calc(100vw - 40px)' });
document.body.append(link);
