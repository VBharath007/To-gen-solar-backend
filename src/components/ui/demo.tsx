import Pattern from "@/components/ui/rate-limit-alert-dialog"; 
 
export default function Default() { 
  return ( 
    <div className="flex min-h-[760px] w-full items-center justify-center p-6"> 
      <Pattern defaultOpen /> 
    </div> 
  ); 
} 
