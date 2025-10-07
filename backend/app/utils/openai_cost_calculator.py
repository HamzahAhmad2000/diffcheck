# app/utils/openai_cost_calculator.py

from decimal import Decimal
from typing import Optional, Dict, Any

class OpenAICostCalculator:
    """
    Calculate OpenAI API costs based on model and token usage.
    Prices are per 1,000 tokens as of October 2024.
    """
    
    # OpenAI pricing per 1,000 tokens (USD)
    PRICING = {
        'gpt-4o': {
            'input': Decimal('0.0025'),   # $2.50 per 1M tokens
            'output': Decimal('0.01')     # $10.00 per 1M tokens
        },
        'gpt-4o-mini': {
            'input': Decimal('0.00015'),  # $0.15 per 1M tokens
            'output': Decimal('0.0006')   # $0.60 per 1M tokens
        },
        'gpt-4-turbo': {
            'input': Decimal('0.01'),     # $10.00 per 1M tokens
            'output': Decimal('0.03')     # $30.00 per 1M tokens
        },
        'gpt-4': {
            'input': Decimal('0.03'),     # $30.00 per 1M tokens
            'output': Decimal('0.06')     # $60.00 per 1M tokens
        },
        'gpt-3.5-turbo': {
            'input': Decimal('0.0005'),   # $0.50 per 1M tokens
            'output': Decimal('0.0015')   # $1.50 per 1M tokens
        },
        'gpt-3.5-turbo-instruct': {
            'input': Decimal('0.0015'),   # $1.50 per 1M tokens
            'output': Decimal('0.002')    # $2.00 per 1M tokens
        }
    }
    
    @classmethod
    def calculate_cost(cls, model: str, input_tokens: int, output_tokens: int) -> Decimal:
        """
        Calculate the total cost for an OpenAI API call.
        
        Args:
            model: The OpenAI model used (e.g., 'gpt-4o', 'gpt-3.5-turbo')
            input_tokens: Number of input tokens
            output_tokens: Number of output tokens
            
        Returns:
            Total cost in USD as Decimal
        """
        if model not in cls.PRICING:
            # Default to gpt-4o pricing if model not found
            model = 'gpt-4o'
        
        pricing = cls.PRICING[model]
        
        # Calculate cost per token (divide by 1000 since pricing is per 1K tokens)
        input_cost = (Decimal(input_tokens) * pricing['input']) / 1000
        output_cost = (Decimal(output_tokens) * pricing['output']) / 1000
        
        return input_cost + output_cost
    
    @classmethod
    def extract_usage_from_response(cls, response: Dict[Any, Any]) -> Dict[str, Any]:
        """
        Extract token usage and cost information from OpenAI API response.
        
        Args:
            response: OpenAI API response dictionary
            
        Returns:
            Dictionary with usage information
        """
        usage_info = {
            'input_tokens': 0,
            'output_tokens': 0,
            'total_tokens': 0,
            'model_used': None,
            'openai_request_id': None,
            'openai_cost_usd': Decimal('0')
        }
        
        try:
            # Extract model information
            if 'model' in response:
                usage_info['model_used'] = response['model']
            
            # Extract request ID if available
            if hasattr(response, 'id'):
                usage_info['openai_request_id'] = response.id
            elif 'id' in response:
                usage_info['openai_request_id'] = response['id']
            
            # Extract token usage
            if 'usage' in response:
                usage = response['usage']
                usage_info['input_tokens'] = usage.get('prompt_tokens', 0)
                usage_info['output_tokens'] = usage.get('completion_tokens', 0)
                usage_info['total_tokens'] = usage.get('total_tokens', 0)
                
                # Calculate cost if we have model and token info
                if usage_info['model_used'] and (usage_info['input_tokens'] or usage_info['output_tokens']):
                    usage_info['openai_cost_usd'] = cls.calculate_cost(
                        usage_info['model_used'],
                        usage_info['input_tokens'],
                        usage_info['output_tokens']
                    )
            
        except Exception as e:
            print(f"Error extracting usage from OpenAI response: {e}")
        
        return usage_info
    
    @classmethod
    def get_model_pricing_info(cls) -> Dict[str, Dict[str, str]]:
        """
        Get formatted pricing information for all supported models.
        
        Returns:
            Dictionary with model pricing information
        """
        pricing_info = {}
        
        for model, prices in cls.PRICING.items():
            pricing_info[model] = {
                'input_per_1k': f"${float(prices['input']):.4f}",
                'output_per_1k': f"${float(prices['output']):.4f}",
                'input_per_1m': f"${float(prices['input'] * 1000):.2f}",
                'output_per_1m': f"${float(prices['output'] * 1000):.2f}"
            }
        
        return pricing_info
