(()=>{
  const guidance={overview:'Participation totals are dated source observations, not candidate results. Changes may reflect delayed reports or corrections.',counties:'Compare like voting modes and cutoffs. Mail sent, mail received and accepted ballots are distinct; missing records are not zero.',polling:'Polls measure sampled preferences during their field dates. They are not votes counted, forecasts or race calls. Contrary evidence remains relevant.',history:'Compare equivalent periods and definitions. Partial historical coverage cannot establish a statewide trend or candidate-vote swing.',evidence:'Official observations, publisher reproductions and calculated values carry different evidentiary weight. Review source dates and publication status separately.'};
  function update(){
    const day=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const title=document.getElementById('election-phase-title'),copy=document.getElementById('election-phase-copy');
    if(!title||!copy)return;
    if(day<'2026-11-03'){
      title.textContent='Early voting closed · Pre-election reconciliation';
      copy.textContent='Regular in-person early voting ended October 30. Our focus before November 3 is closing turnout reports, mail-ballot updates and final polling. Published totals may change as sources post delayed reports or corrections; changes do not necessarily represent additional voting since our previous update.';
    }else{
      title.textContent=day==='2026-11-03'?'Election Day · Participation and results are distinct':'Post-election review · Check result status and source dates';
      copy.textContent='Early-voting participation is not candidate vote results. Any results shown must be identified by source, observation time and preliminary or official status. A race call is not certification, and a scheduled review does not guarantee a new publication. Follow official election sources for voting instructions and results.';
    }
    Object.entries(guidance).forEach(([id,text])=>{const page=document.getElementById(id);if(!page||!page.children.length)return;let note=page.querySelector('.section-context');if(!note){note=document.createElement('p');note.className='section-context';page.prepend(note);}note.textContent=text;});
  }
  document.addEventListener('DOMContentLoaded',update);
  document.addEventListener('civic:render',update);
  setInterval(update,60000);
})();
