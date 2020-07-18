import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IOrderProduct {
  product_id: string;
  quantity: number;
  price: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    // should not be able to create an order with a invalid customer
    const customer = await this.customersRepository.findById(customer_id);
    if (!customer) {
      throw new AppError('Customer not found');
    }

    const productsIds = products.map(product => ({ id: product.id }));

    const findProducts = await this.productsRepository.findAllById(productsIds);

    // should not be able to create an order with invalid products
    if (findProducts.length !== products.length) {
      throw new AppError('Some ordered product does not exist');
    }

    const orderedProducts: IOrderProduct[] = [];

    const updateProductsQuantities = findProducts.map(findProduct => {
      const stockQuantity = findProduct.quantity;

      const orderedProduct = products.find(
        product => product.id === findProduct.id,
      );

      if (!orderedProduct) {
        throw new AppError('Product not found.');
      }

      orderedProducts.push({
        product_id: orderedProduct.id,
        quantity: orderedProduct.quantity,
        price: findProduct.price,
      });

      const orderedQuantity = orderedProduct.quantity;

      // should not be able to create an order with products with insufficient quantities
      if (stockQuantity < orderedQuantity) {
        throw new AppError(
          `Product ${findProduct.name} has insufficient quantity. The available amount is: ${findProduct.quantity}`,
        );
      }

      // should be able to subtract an product total quantity when it is ordered
      const updateProduct = {
        id: findProduct.id,
        quantity: findProduct.quantity - orderedProduct.quantity,
      };

      return updateProduct;
    });

    await this.productsRepository.updateQuantity(updateProductsQuantities);

    // should be able to create a new order
    const order = await this.ordersRepository.create({
      customer,
      products: orderedProducts,
    });

    return order;
  }
}

export default CreateOrderService;
