// src/components/ui/card/index.js
export const Card = ({ className, ...props }) => {
    return (
      <div className={`bg-white rounded-lg shadow ${className}`} {...props} />
    );
  };
  
  export const CardHeader = ({ className, ...props }) => {
    return (
      <div className={`p-6 pb-2 ${className}`} {...props} />
    );
  };
  
  export const CardTitle = ({ className, ...props }) => {
    return (
      <h3 className={`text-xl font-semibold ${className}`} {...props} />
    );
  };
  
  export const CardContent = ({ className, ...props }) => {
    return (
      <div className={`p-6 pt-2 ${className}`} {...props} />
    );
  };