import { Column, Entity, PrimaryGeneratedColumn, BaseEntity } from "typeorm";

@Entity("pools")
export class Pool extends BaseEntity {
    @PrimaryGeneratedColumn("uuid")
    id!: string;

    @Column()
    type!: string;

    @Column({ type: "float" })
    tvl!: number;

    @Column({ type: 'json' })
    apr!: object;
}
